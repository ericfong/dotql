import { applyEnhancers } from './util'

const assert = require('assert')
const _ = require('lodash')

// const g = _.get

const PRIMITIVE_TYPES = { String: 1, Int: 1, Float: 1, Boolean: 1, Object: 1 }
const WHERE_KEY = '$where'
const ARGUMENTS_KEY = '$args'
const MUTATE_KEY = '$mutate'
const AS_KEY = '$as'
const OPERATORS = {
  [WHERE_KEY]: 1,
  [ARGUMENTS_KEY]: 1,
  [MUTATE_KEY]: 1,
  [AS_KEY]: 1,
}
export const QUERIES_TYPE = 'Queries'
export const MUTATIONS_TYPE = 'Mutations'

export default class Server {
  constructor(conf) {
    Object.assign(this, conf)
  }

  async resolveField(dot, spec, context, info) {
    const { field, client } = info
    const fieldArgs = spec[ARGUMENTS_KEY] || spec[WHERE_KEY]
    const fieldItemType = _.isArray(field.type) ? _.head(field.type) : field.type
    await this.dependETagKey(context, fieldItemType, fieldArgs)
    return field.resolve.call(client, dot, fieldArgs, context, info)
  }

  async resolve(dot, specs, context) {
    const client = this
    const { schema } = client
    // console.log('>resolveRecursive>', dot, specs)
    const typename = dot.$type
    if (PRIMITIVE_TYPES[typename]) return dot

    const Type = schema[typename]
    assert(Type, `Type "${typename}" is missing in schema`)

    // whole-dot (use field resolve instead of $mutate)
    // mutate before resolve
    const mutateAction = specs[MUTATE_KEY]
    if (mutateAction) {
      const mutateFunc = Type[MUTATE_KEY]
      assert(mutateFunc, `"${MUTATE_KEY}" function is missing in Type "${typename}"`)
      await mutateFunc.call(client, dot, mutateAction, context)
    }

    // sub-fields
    await Promise.all(
      _.map(specs, async (spec, fieldName) => {
        // ignore operator from parent spec
        if (OPERATORS[fieldName]) return

        // get field & resolve
        const field = Type[fieldName]
        const resolve = _.get(field, 'resolve')

        if (!resolve && field in dot) return

        assert(resolve, `${typename}.${fieldName} is missing resolve function`)

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

  // two main entry point for end-user
  get(spec, context = {}) {
    const isMutation = spec.$type === MUTATIONS_TYPE || spec[MUTATE_KEY]
    const dot = { $type: isMutation ? MUTATIONS_TYPE : QUERIES_TYPE }
    return this.resolve(dot, isMutation ? _.omit(spec, MUTATE_KEY) : spec, context)
  }

  // onSnapshot(args, option, onNext /* , onError, onCompletion */) {},

  // ----------------------------------------------------------------------------------------------

  queryNormalizeSpec(args) {
    if (_.isArray(args)) return _.head(args)
    // string = prepared query
    return args
  }

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

  async mutateETag(dot) {
    const key = this.calcETagKey(dot.$type, dot)
    return this.setETag(key, new Date().toISOString())
  }

  async notMatchETags(oldETags) {
    const bools = await Promise.all(
      _.map(oldETags, async (oldETag, key) => {
        return (await this.getETag(key)) !== oldETag
      })
    )
    return _.some(bools, Boolean)
  }

  query(specs, context = {}) {
    // console.log('>> server.query', specs)
    if (specs.$batch) {
      let p = Promise.resolve([])
      _.forEach(specs.$batch, ({ args, notMatch }) => {
        p = p.then(async resBatch => {
          const normArgs = this.queryNormalizeSpec(args)

          let shouldRun = !notMatch
          if (!shouldRun) {
            shouldRun = await this.notMatchETags(notMatch)
          }

          const result = shouldRun ? await this.get(normArgs, context) : undefined

          resBatch.push({ result, eTags: context.eTags })
          return resBatch
        })
      })
      return p.then(results => ({ $batch: results }))
    }
    return this.get(this.queryNormalizeSpec(specs), context)
  }
}

/*
Call Sequence
- query
- get
- resolve
*/

export const createServer = (option, enhancers) => applyEnhancers(new Server(option), enhancers)
