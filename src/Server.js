import invariant from 'invariant'
import _ from 'lodash'

import { promiseMapSeries } from './util'

const DEV = process.env.NODE_ENV !== 'production'

const PRIMITIVE_TYPES = { String: 1, Int: 1, Float: 1, Boolean: 1, Object: 1 }
const TYPE_KEY = '$type'
const ARGUMENTS_KEY = '$args'
const AS_KEY = '$as'
const OPERATORS = {
  [TYPE_KEY]: 1,
  $query: 1,
  $mutation: 1,
  [ARGUMENTS_KEY]: 1,
  [AS_KEY]: 1,
}
export const QUERIES_TYPE = 'Queries'
export const MUTATIONS_TYPE = 'Mutations'

// const isMutate = runStr => _.startsWith(runStr, 'mutate ')
// const getPrepareName = runStr => `${runStr}`.substr(7)

const prepareFieldResult = async (_result, fieldType, func) => {
  if (!_result || PRIMITIVE_TYPES[fieldType]) return _result
  // console.log('prepareFieldResult', _result, fieldType)
  const isArrayType = _.isArray(fieldType)
  const result = isArrayType ? _result : [_result]
  const itemType = isArrayType ? _.head(fieldType) : fieldType
  const newResult = await Promise.all(
    _.map(result, item => {
      item.$type = itemType
      return func(item)
    })
  )
  return isArrayType ? newResult : _.head(newResult)
}

export default class Server {
  // conf props: getETag, setETag, calcQueryChannel, calcDotChannel

  constructor(conf) {
    this.prepared = {}
    Object.assign(this, conf)
  }

  async resolveField(dot, spec, context, info) {
    const { field, fieldName } = info
    if (!field.resolve) return dot[fieldName]

    const fieldArgs = spec[ARGUMENTS_KEY]
    const isArrayType = _.isArray(field.type)
    const fieldItemType = isArrayType ? _.head(field.type) : field.type
    const notPrimitiveType = !PRIMITIVE_TYPES[fieldItemType]

    if (!context.isMutation && notPrimitiveType) {
      await this.dependETagKey(context, fieldItemType, fieldArgs)
    }

    const result = field.resolve.call(this, dot, fieldArgs, context, info)

    if (context.isMutation && notPrimitiveType) {
      await Promise.all(
        _.map(isArrayType ? result : [result], resultItem => {
          return this.mutateETag(resultItem, fieldItemType)
        })
      )
    }
    return result
  }

  async resolve(dot, specs, context) {
    const { schema } = this
    const typename = dot.$type
    if (PRIMITIVE_TYPES[typename]) return dot

    const Type = schema[typename]
    if (DEV) invariant(Type, `Type "${typename}" is missing in schema`)

    // sub-fields
    await Promise.all(
      _.map(specs, async (spec, fieldName) => {
        if (OPERATORS[fieldName]) return // ignore operator

        // get field & resolve
        const field = Type[fieldName]
        if (DEV) invariant(field, `Field ${fieldName} is missing in type ${typename}`)

        // resolveField
        const resolveAs = spec[AS_KEY] || fieldName
        const result = await this.resolveField(dot, spec, context, {
          field,
          fieldName,
          resolveAs,
          resolveOthers: (q, _dot = dot) => this.resolve(_dot, q, context),
        })
        dot[resolveAs] = await prepareFieldResult(result, field.type, item => this.resolve(item, spec, context))
      })
    )

    // console.log('resolveRecursive-out:', dot, specs)
    return dot
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
            return _.pick(spec, value.$refs)
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
    // context.eTags is filled by this.resolve
    const returnResult = result => (hasHeader ? { result, eTags: context.eTags } : result)
    const { spec, notMatch } = hasHeader ? _body : { spec: _body }

    const shouldRun = await this.notMatchETags(notMatch)
    if (!shouldRun) {
      // return eTags = undefined means no change
      return returnResult(undefined)
    }

    const normSpec = this.queryNormalizeSpec(spec)
    const isMutation = (context.isMutation = spec.$mutation)
    const dot = { $type: isMutation ? MUTATIONS_TYPE : QUERIES_TYPE }
    // console.log(normSpec, spec, dot)
    const result = await this.resolve(dot, normSpec, context)
    return returnResult(result)
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
    // TODO how to handle oldETags === {}
    const bools = await Promise.all(
      _.map(oldETags, async (oldETag, key) => {
        return (await this.getETag(key)) !== oldETag
      })
    )
    return _.some(bools, Boolean)
  }

  query(body, context = {}) {
    if (Array.isArray(body)) {
      return promiseMapSeries(body, eachBody => this.get(eachBody, context))
    }
    return this.get(body, context)
  }
}

/*
Call Sequence
- query
- get
- resolve
*/
