import invariant from 'invariant'
import _ from 'lodash'
import DataLoader from 'dataloader'

import { promiseMapSeries, promiseMap } from './util'

const DEV = process.env.NODE_ENV !== 'production'

const PRIMITIVE_TYPES = { String: 1, Int: 1, Float: 1, Boolean: 1, Object: 1 }
const TYPE_KEY = '$type'
const ARGUMENTS_KEY = '$args'
const OPERATORS = {
  [TYPE_KEY]: 1,
  $query: 1,
  $mutation: 1,
  [ARGUMENTS_KEY]: 1,
  $from: 1,
}
export const QUERIES_TYPE = 'Queries'
export const MUTATIONS_TYPE = 'Mutations'

const loopFieldResult = async (result, fieldType, func) => {
  if (!result || !fieldType) return result
  const isArrayType = _.isArray(fieldType)
  if (isArrayType) {
    const subTypename = _.head(fieldType)
    return promiseMap(_.isArray(result) ? result : [result], item => {
      return func(item, subTypename)
    })
  }
  return func(result, fieldType)
}

const defaultPreresolve = () => ({})

export default class Server {
  // conf props: schema, getETag, setETag, calcQueryChannel, calcDotChannel, validationRules

  constructor(conf) {
    this.prepared = {}
    Object.assign(this, conf)
  }

  async resolveField(input, fieldArgs, context, info) {
    const { field, typename, fieldName } = info
    if (!field || !field.resolve) return input[fieldName]
    const { type, resolve, batchLoader } = field

    const isArrayType = _.isArray(type)
    const subTypename = isArrayType ? _.head(type) : type
    const notPrimitiveType = !PRIMITIVE_TYPES[subTypename]

    if (!context.isMutation && notPrimitiveType) {
      await this.dependETagKey(context, subTypename, fieldArgs)
    }

    const { batch } = context
    batch.load = key => {
      const loaderName = `_${typename}.${fieldName}`
      if (!batch[loaderName]) {
        if (DEV) invariant(batchLoader, `batchLoader is missing in field "${typename}.${fieldName}"`)
        batch[loaderName] = new DataLoader(batchLoader)
      }
      return batch[loaderName].load(key)
    }

    const result = await resolve(input, fieldArgs, context, info)

    if (context.isMutation && notPrimitiveType) {
      await promiseMap(isArrayType ? result : [result], resultItem => {
        return this.mutateETag(resultItem, subTypename)
      })
    }
    return result
  }

  async resolveDot(input, specs, context) {
    const typename = input.$type
    const Type = this.schema[typename]
    if (DEV) invariant(Type, `Type "${typename}" is missing in schema`)

    const preresolve = Type.preresolve || defaultPreresolve
    const output = await preresolve(input, context)
    output.$type = typename

    // sub-fields
    await Promise.all(
      _.map(specs, async (spec, outputKey) => {
        if (OPERATORS[outputKey]) return // ignore operator
        const fieldName = spec.$from || outputKey
        const field = Type[fieldName]

        // resolveField
        const outputValue = await this.resolveField(input, spec[ARGUMENTS_KEY], context, {
          typename,
          field,
          fieldName,
          outputKey,
        })
        // console.log('>>A', fieldName, outputValue)

        output[outputKey] = await loopFieldResult(outputValue, field && field.type, (item, subTypename) => {
          // console.log('>>C', item, subTypename)
          if (PRIMITIVE_TYPES[subTypename]) return item
          item.$type = subTypename
          return this.resolveDot(item, spec, context)
        })
        // console.log('>>B', outputKey, fieldName, output[outputKey])
      })
    )
    // console.log('FINAL', output)
    return output
  }

  // ----------------------------------------------------------------------------------------------

  queryNormalizeSpec(spec) {
    const { $query, $mutation } = spec
    const strQuery = _.isString($query) && $query
    const strMut = _.isString($mutation) && $mutation
    if (strQuery || strMut) {
      const prepared = strMut ? this.prepared.Mutations[strMut] : this.prepared.Queries[strQuery]
      if (DEV) invariant(prepared, `prepared statement ${strMut ? 'Mutations' : 'Queries'}.${strMut || strQuery} is missing`)
      const newSpec = _.cloneDeepWith(prepared, value => {
        if (value) {
          if (value.$ref) {
            if (DEV) invariant(value.$ref in spec, `$ref ${value.$ref} is missing`)
            return spec[value.$ref]
          }
          if (value.$refs) {
            if (_.isArray(value.$refs)) return _.pick(spec, value.$refs)
            // if object
            return _.mapValues(value.$refs, specKey => spec[specKey])
          }
        }
        return undefined
      })
      if (strMut) newSpec.$mutation = strMut
      if (strQuery) newSpec.$query = strQuery
      return newSpec
    }
    // string = prepared query
    return spec
  }

  // two main entry point for end-user
  async get(_body, context = {}) {
    const hasHeader = _body?.spec
    const { spec, notMatch } = hasHeader ? _body : { spec: _body }

    // check no exception validationRules for queryMaxDepth, disableAdHocQuery, disableIntrospection,
    _.forEach(this.validationRules, rule => rule(spec))

    const shouldRun = await this.notMatchETags(notMatch)
    if (!shouldRun) {
      // return eTags = undefined means no change
      return hasHeader ? { result: undefined, eTags: undefined } : undefined
    }

    const normSpec = this.queryNormalizeSpec(spec)
    const isMutation = (context.isMutation = spec.$mutation)
    const dot = { $type: isMutation ? MUTATIONS_TYPE : QUERIES_TYPE }
    // resolveDot will fill context.eTags
    const result = await this.resolveDot(dot, normSpec, context)
    return hasHeader ? { result, eTags: context.eTags } : result
  }

  // ----------------------------------------------------------------------------------------------

  getETag(channel) {
    return _.get(this, ['_etags', channel], null)
  }

  setETag(channel, value) {
    return _.set(this, ['_etags', channel], value)
  }

  calcQueryChannel(typename /* , args */) {
    return typename
  }

  calcDotChannel(typename /* , args */) {
    return typename
  }

  async dependETagKey(context, typename, where) {
    const key = this.calcQueryChannel(typename, where)
    _.set(context, ['eTags', key], await this.getETag(key))
  }

  mutateETag(dot, defaultType) {
    dot.$type = dot.$type || defaultType
    const key = this.calcDotChannel(dot.$type, dot)
    return this.setETag(key, new Date().toISOString())
  }

  async notMatchETags(oldETags) {
    if (!oldETags) return true
    const bools = await Promise.all(
      _.map(oldETags, async (oldETag, key) => {
        return (await this.getETag(key)) !== oldETag
      })
    )
    // if oldETags === {}, consider as match, will return false
    return _.some(bools, Boolean)
  }

  query(body, context = {}) {
    this.setupQueryContext(context)
    if (Array.isArray(body)) {
      return promiseMapSeries(body, eachBody => this.get(eachBody, { ...context }))
    }
    return this.get(body, context)
  }

  setupQueryContext(context) {
    context.batch = {}
  }
}

/*
Call Sequence
- query
- get
- resolve
*/
