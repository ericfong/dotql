import { applyEnhancers } from './util'

const assert = require('assert')
const _ = require('lodash')

const DEV = process.env.NODE_ENV !== 'production'

const PRIMITIVE_TYPES = { String: 1, Int: 1, Float: 1, Boolean: 1, Object: 1 }
const TYPE_KEY = '$type'
const EXTEND_KEY = '$extend'
const WHERE_KEY = '$where'
const ARGUMENTS_KEY = '$args'
const AS_KEY = '$as'
const OPERATORS = {
  [TYPE_KEY]: 1,
  [EXTEND_KEY]: 1,
  [WHERE_KEY]: 1,
  [ARGUMENTS_KEY]: 1,
  [AS_KEY]: 1,
}
export const QUERIES_TYPE = 'Queries'
export const MUTATIONS_TYPE = 'Mutations'

export default class Server {
  constructor(conf) {
    this.extensibles = {}
    Object.assign(this, conf)
  }

  async resolveField(dot, spec, context, info) {
    const { field } = info
    const fieldArgs = spec[ARGUMENTS_KEY] || spec[WHERE_KEY]
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
    const client = this
    const { schema } = client
    // console.log('>resolveRecursive>', dot, specs)
    const typename = dot.$type
    if (PRIMITIVE_TYPES[typename]) return dot

    const Type = schema[typename]
    if (DEV) assert(Type, `Type "${typename}" is missing in schema`)

    // sub-fields
    await Promise.all(
      _.map(specs, async (spec, fieldName) => {
        // ignore operator from parent spec
        if (OPERATORS[fieldName]) return

        // get field & resolve
        const field = Type[fieldName]
        const resolve = _.get(field, 'resolve')

        if (!resolve && field in dot) return

        if (DEV) assert(resolve, `${typename}.${fieldName} is missing resolve function`)

        const resolveAs = spec[AS_KEY] || fieldName

        // resolveField
        const result = await client.resolveField(dot, spec, context, {
          client,
          field,
          fieldName,
          resolveAs,
          resolveOthers: (q, _dot = dot) => client.resolve(_dot, q, context),
        })

        // eslint-disable-next-line no-param-reassign
        dot[resolveAs] = result

        if (_.isObject(result) && field.type !== 'Object') {
          // console.log('resolveRecursive-item:', field.type, result)
          let newResult
          // interpret resolve result by field.type
          if (_.isArray(field.type)) {
            const itemType = _.head(field.type)
            newResult = await Promise.all(
              _.map(result, item => {
                // eslint-disable-next-line no-param-reassign
                item.$type = itemType
                return client.resolve(item, spec, context)
              })
            )
          } else {
            result.$type = field.type
            newResult = await client.resolve(result, spec, context)
          }
          // eslint-disable-next-line no-param-reassign
          dot[resolveAs] = newResult
        }
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
        if (value && value.$ref) {
          if (DEV) assert(value.$ref in spec, `$ref ${value.$ref} is missing`)
          return spec[value.$ref]
        }
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

  async dependETagKey(context, typename, whereOrValues) {
    const key = this.calcETagKey(typename, whereOrValues)
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
    if (specs.$batch) {
      let p = Promise.resolve([])
      _.forEach(specs.$batch, ({ spec, notMatch }) => {
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
      return p.then(results => ({ $batch: results }))
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

export const createServer = (option, enhancers) => applyEnhancers(new Server(option), enhancers)
