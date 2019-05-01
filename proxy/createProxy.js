// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import RxMap from './RxMap'

class Proxy {
  constructor(conf = {}) {
    Object.assign(this, conf)
    if (!this.map) this.map = new RxMap()
    this.setAts = {}

    // middleware-point
    this.handle = (args, option) => {
      return this.callServer(args, option)
    }

    // use ttl/maxAge which should similar to apollo cache-and-network
    // network-only or no-cache for mutation

    // end-user-entry-point
    this.query = (args, option = {}) => {
      if (option.cachePolicy === 'no-cache') {
        return this.handle(args, option)
      }

      const { map } = this
      const key = this.toKey(args, option)
      if (map.has(key)) return map.get(key)

      // assert(option.callServer, 'createProxy require callServer function')
      const promise = this.handle(args, option)

      map.set(key, promise)
      this.setAts[key] = new Date()
      return promise
    }

    // end-user-entry-point
    this.watch = (args, onNext, option = {}) => {
      const { map } = this
      const key = this.toKey(args, option)
      Promise.resolve(this.query(args, option)).then(onNext)
      return map.listen(key, onNext)
    }

    this.getCache = (args, option = {}) => {
      return this.map.get(this.toKey(args, option))
    }
  }

  toKey(args, option) {
    if (option && option.key) return option.key
    if (_.isString(args)) return args
    const key = stringify(args)
    return (option.key = key)
  }
}

export const withBatch = proxy => {
  const superHandle = proxy.handle

  async function batchFlushToServer() {
    const { batchingSpecs, batchingOptions, batchingPromises } = proxy
    if (batchingSpecs.length === 0) return
    proxy.batchingSpecs = []
    proxy.batchingOptions = []
    proxy.batchingPromises = []
    // console.log('batchDebounce', batchingSpecs, batchingOptions)

    const { $batch: results = [] } = (await superHandle({ $batch: batchingSpecs }, batchingOptions)) || {}
    _.forEach(batchingPromises, (p, i) => {
      p.resolve(results[i])
    })
  }

  Object.assign(proxy, {
    batchingSpecs: [],
    batchingOptions: [],
    batchingPromises: [],
    batchDebounce: _.debounce(batchFlushToServer),

    batchFlushToServer,

    handle(spec, option) {
      proxy.batchingSpecs.push(spec)
      proxy.batchingOptions.push(option)
      const pProps = {}
      const p = new Promise((_resolve, _reject) => {
        pProps.resolve = _resolve
        pProps.reject = _reject
      })
      Object.assign(p, pProps)
      proxy.batchingPromises.push(p)
      proxy.batchDebounce(this)
      return p
    },
  })
}

export const defaultEnhancers = [withBatch]

const mixinEnhancers = (base, enhancers) => {
  if (enhancers) {
    const flatEnhancers = _.isArray(enhancers) ? _.flattenDeep(enhancers) : [enhancers]
    _.forEach(flatEnhancers, enhancer => {
      enhancer(base)
    })
  }
}

const createProxy = (option, enhancers = defaultEnhancers) => {
  const proxy = new Proxy(option)
  mixinEnhancers(proxy, enhancers)
  return proxy
}
export default createProxy
