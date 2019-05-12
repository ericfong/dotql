import { mixin } from './util'

const assert = require('assert')
const _ = require('lodash')

const DEV = process.env.NODE_ENV !== 'production'

const PRIMITIVE_TYPES = { String: 1, Int: 1, Float: 1, Boolean: 1, Object: 1 }
const TYPE_KEY = '$type'
const EXTEND_KEY = '$extend'
const ARGUMENTS_KEY = '$args'
const AS_KEY = '$as'
const OPERATORS = {
  [TYPE_KEY]: 1,
  [EXTEND_KEY]: 1,
  [ARGUMENTS_KEY]: 1,
  [AS_KEY]: 1,
}
export const QUERIES_TYPE = 'Queries'
export const MUTATIONS_TYPE = 'Mutations'

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
  constructor(conf) {
    this.extensibles = {}
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
      _.forEach(isArrayType ? result : [result], resultItem => {
        this.mutateETag(resultItem, fieldItemType)
      })
    }
    return result
  }

  async resolve(dot, specs, context) {
    const { schema } = this
    const typename = dot.$type
    if (PRIMITIVE_TYPES[typename]) return dot

    const Type = schema[typename]
    if (DEV) assert(Type, `Type "${typename}" is missing in schema`)

    // sub-fields
    await Promise.all(
      _.map(specs, async (spec, fieldName) => {
        if (OPERATORS[fieldName]) return // ignore operator

        // get field & resolve
        const field = Type[fieldName]
        if (DEV) assert(field, `Field ${fieldName} is missing in type ${typename}`)

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
    const extendName = spec[EXTEND_KEY]
    if (extendName) {
      const extensible = _.get(this.extensibles, [spec[TYPE_KEY], extendName])
      if (DEV) assert(extensible, `extensibles ${spec[TYPE_KEY]}.${extendName} is missing`)
      const extended = _.cloneDeepWith(extensible, value => {
        if (value) {
          if (value.$ref) {
            if (DEV) assert(value.$ref in spec, `$ref ${value.$ref} is missing`)
            return spec[value.$ref]
          }
          if (value.$refs) {
            return _.pick(spec, value.$refs)
          }
        }
        return undefined
      })
      extended.$type = spec.$type
      return extended
    }
    // string = prepared query
    return spec
  }

  // two main entry point for end-user
  get(spec, context = {}) {
    const isMutation = (context.isMutation = spec.$type === MUTATIONS_TYPE)
    spec.$type = isMutation ? MUTATIONS_TYPE : QUERIES_TYPE
    const normSpec = this.queryNormalizeSpec(spec)
    const dot = { $type: isMutation ? MUTATIONS_TYPE : QUERIES_TYPE }
    return this.resolve(dot, normSpec, context)
  }

  // ----------------------------------------------------------------------------------------------

  async getETag(channel) {
    return _.get(this, ['_etags', channel])
  }

  async setETag(channel, value) {
    return _.set(this, ['_etags', channel], value)
  }

  calcETagKey(typename /* , whereOrValues */) {
    return typename
  }

  async dependETagKey(context, typename, where) {
    const key = this.calcETagKey(typename, where)
    _.set(context, ['eTags', key], await this.getETag(key))
  }

  async mutateETag(dot, defaultType) {
    dot.$type = dot.$type || defaultType
    const key = this.calcETagKey(dot.$type, dot)
    // console.log('mutateETag', dot)
    return this.setETag(key, new Date().toISOString())
  }

  async notMatchETags(oldETags) {
    const bools = await Promise.all(
      _.map(oldETags, async (oldETag, key) => {
        // console.log('notMatchETags', key, oldETag, await this.getETag(key))
        return (await this.getETag(key)) !== oldETag
      })
    )
    return _.some(bools, Boolean)
  }

  query(specs, context = {}) {
    // console.log('>> server.query', specs)
    if (Array.isArray(specs)) {
      let p = Promise.resolve([])
      _.forEach(specs, ({ spec, notMatch }) => {
        p = p.then(async resBatch => {
          let shouldRun = !notMatch
          if (!shouldRun) {
            shouldRun = await this.notMatchETags(notMatch)
          }

          const result = shouldRun ? await this.get(spec, context) : undefined

          resBatch.push({ result, eTags: context.eTags })
          return resBatch
        })
      })
      return p
    }
    return this.get(specs, context)
  }
}

/*
Call Sequence
- query
- get
- resolve
*/

export const createServer = (option, enhancers) => new (mixin(Server, enhancers))(option)
