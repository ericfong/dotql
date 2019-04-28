import { enhance } from '../util'

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
const QUERIES_TYPE = 'Queries'
const MUTATIONS_TYPE = 'Mutations'

const serverFuncs = {
  resolveField(dot, spec, context, info) {
    const { field, client } = info
    return field.resolve.call(client, dot, spec[ARGUMENTS_KEY] || spec[WHERE_KEY], context, info)
  },

  async resolve(dot, specs, context) {
    const client = this
    const { schema } = client
    // console.log('>resolveRecursive>', dot, specs)
    const typename = dot.__typename
    if (PRIMITIVE_TYPES[typename]) return dot

    const Type = schema[typename]
    assert(Type, `Type "${typename}" is missing in schema`)

    // whole-dot
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
                item.__typename = itemType
                return client.resolve(item, spec, context)
              })
            )
          } else {
            result.__typename = field.type
            newResult = await client.resolve(result, spec, context)
          }
          // eslint-disable-next-line no-param-reassign
          dot[resolveAs] = newResult
        }
      })
    )

    // console.log('resolveRecursive-out:', dot, specs)
    return dot
  },

  // ----------------------------------------------------------------------------------------------

  // two main entry point for end-user
  get(spec, context = {}) {
    // console.log('>>server', spec)
    const client = this
    const isMutation = spec.__typename === MUTATIONS_TYPE || spec[MUTATE_KEY]
    const dot = { __typename: isMutation ? MUTATIONS_TYPE : QUERIES_TYPE }
    return client.resolve(dot, isMutation ? _.omit(spec, MUTATE_KEY) : spec, context)
  },

  // onSnapshot(args, option, onNext /* , onError, onCompletion */) {},

  // ----------------------------------------------------------------------------------------------

  queryNormalizeSpec(args) {
    if (_.isArray(args)) return _.head(args)
    // string = prepared query
    return args
  },

  // rename to batch
  query(specs, context = {}) {
    // console.log('>> server.query', specs)
    if (specs.$batch) {
      let p = Promise.resolve([])
      _.forEach(specs.$batch, spec => {
        p = p.then(async results => {
          const result = await this.get(this.queryNormalizeSpec(spec), context)
          results.push(result)
          return results
        })
      })
      return p.then(results => ({ $batch: results }))
    }
    return this.get(this.queryNormalizeSpec(specs), context)
  },
}

/*
Call Sequence
- query
- get
- resolve
*/

const createServer = (option, enhancers) => {
  const client = { ...option, ...serverFuncs }
  return enhance(client, enhancers)
}
export default createServer
