import _ from 'lodash'

export const mixin = (target, mixins) => {
  if (!mixins) return target
  return _.reduce(_.isArray(mixins) ? _.flattenDeep(mixins) : [mixins], (base, mix) => mix(base), target)
}

// export const applyEnhancers = (target, enhancers) => {
//   if (!enhancers) return target
//   const flatEnhancers = _.isArray(enhancers) ? _.flattenDeep(enhancers) : [enhancers]
//   _.forEach(flatEnhancers, enhancer => {
//     enhancer(target)
//   })
//   return target
// }

export const promiseMapSeries = (list, func) => {
  return _.reduce(
    list,
    (promise, v, k) => {
      return promise.then(async acc => {
        acc[k] = await func(v, k, list)
        return acc
      })
    },
    Promise.resolve(_.isArrayLikeObject(list) ? [] : {})
  )
}

export const promiseMap = (list, func) => Promise.all(_.map(list, func))
