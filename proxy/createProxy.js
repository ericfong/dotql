// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import RxMap from './RxMap'

class Proxy {
  constructor(option = {}) {
    Object.assign(this, option)
    if (!this.map) this.map = new RxMap()
    this.setAts = {}
  }

  toKey(args, option) {
    if (option && option.key) return option.key
    if (_.isString(args)) return args
    const key = stringify(args)
    return (option.key = key)
  }

  // apollo: cache-first, cache-and-network, network-only, cache-only, no-cache.   keyv: ttl || mem maxAge

  set(args, value, option) {
    const key = this.toKey(args, option)
    this.setAts[key] = new Date()
    return this.map.set(key, value)
  }

  // middleware-point
  handle(args, option) {
    return this.callServer(args, option)
  }

  // end-user-entry-point
  get(args, option = {}) {
    const { map } = this
    const key = this.toKey(args, option)
    if (map.has(key)) return map.get(key)

    // assert(option.callServer, 'createProxy require callServer function')
    const promise = this.handle(args, option)

    map.set(key, promise)
    return promise
  }

  // end-user-entry-point
  query(args, option) {
    return this.get(args, option)
  }

  // end-user-entry-point
  watch(args, onNext, option = {}) {
    const { map } = this
    const key = this.toKey(args, option)
    Promise.resolve(this.get(args, option)).then(onNext)
    return map.listen(key, onNext)
  }
}

export const withBatch = proxy => {
  const superHandle = proxy.handle.bind(proxy)

  async function batchFlushToServer() {
    const { batchingSpecs, batchingOptions, batchingPromises } = this
    if (batchingSpecs.length === 0) return
    this.batchingSpecs = []
    this.batchingOptions = []
    this.batchingPromises = []
    // console.log('batchDebounce', batchingSpecs, batchingOptions)

    const { $batch: results = [] } = (await superHandle({ $batch: batchingSpecs }, batchingOptions)) || {}
    _.forEach(batchingPromises, (p, i) => {
      p.resolve(results[i])
    })
  }

  return {
    batchingSpecs: [],
    batchingOptions: [],
    batchingPromises: [],
    batchDebounce: _.debounce(batchFlushToServer),

    batchFlushToServer,

    handle(spec, option) {
      this.batchingSpecs.push(spec)
      this.batchingOptions.push(option)
      const pProps = {}
      const p = new Promise((_resolve, _reject) => {
        pProps.resolve = _resolve
        pProps.reject = _reject
      })
      Object.assign(p, pProps)
      this.batchingPromises.push(p)
      this.batchDebounce(this)
      return p
    },
  }
}

export const defaultEnhancers = [withBatch]

const mixinEnhancers = (base, enhancers) => {
  if (enhancers) {
    const flatEnhancers = _.isArray(enhancers) ? _.flattenDeep(enhancers) : [enhancers]
    _.forEach(flatEnhancers, enhancer => {
      const mixins = enhancer(base)
      if (mixins) {
        Object.assign(base, mixins)
      }
    })
  }
}

const createProxy = (option, enhancers = defaultEnhancers) => {
  const proxy = new Proxy(option)
  mixinEnhancers(proxy, enhancers)
  return proxy
}
export default createProxy
