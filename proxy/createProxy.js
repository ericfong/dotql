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

    this.getCache = (args, option = {}) => {
      return this.map.get(this.toKey(args, option))
    }
  }

  // end-user-entry-point
  watch = (args, onNext, option = {}) => {
    const key = this.toKey(args, option)
    Promise.resolve(this.query(args, option)).then(onNext)
    // listen
    const w = this.watching[key] || { count: 0 }
    this.watching[key] = { count: w.count + 1, args, option }
    const removeListener = this.map.listen(key, onNext)
    return () => {
      removeListener()
      const count = --this.watching[key].count
      if (count <= 0) {
        delete this.watching[key]
      }
    }
  }

  watching = {}

  getWatching = () => this.watching

  mergeWatching = (key, values) => {
    const watching = this.watching[key]
    if (watching) Object.assign(watching, values)
  }

  toKey(args, option) {
    if (option && option.key) return option.key
    const key = _.isString(args) ? args : stringify(args)
    return (option.key = key)
  }
}

export const withBatch = proxy => {
  const superHandle = proxy.handle

  async function batchFlushToServer(pingIfEmpty) {
    const { batchingSpecs, batchingOptions, batchingPromises } = proxy
    if (batchingSpecs.length === 0 && !pingIfEmpty) return
    proxy.batchingSpecs = []
    proxy.batchingOptions = []
    proxy.batchingPromises = []
    // console.log('batchDebounce', batchingSpecs, batchingOptions)

    // $batch from batchingSpecs
    const $batch = _.map(batchingSpecs, args => ({ args }))
    const batchedKeyArr = _.map(batchingOptions, 'key')

    // attach watching
    const batchedKeyTable = _.keyBy(batchedKeyArr)
    _.forEach(proxy.getWatching(), (w, key) => {
      if (!batchedKeyTable[key]) {
        $batch.push({ args: w.args, notMatch: w.eTag })
        batchedKeyArr.push(key)
      }
    })

    // await server call
    const res = (await superHandle({ $batch }, batchingOptions)) || {}
    const resBatch = res.$batch || []

    _.forEach(batchingPromises, (p, i) => {
      p.resolve(resBatch[i].result)
    })

    _.forEach(resBatch, (w, i) => {
      // try {
      proxy.mergeWatching(batchedKeyArr[i], { eTag: w.eTag })
      // } catch (err) {
      //   console.error(`index=${i} key=${batchedKeyArr[i]}`, err)
      // }
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
      proxy.batchDebounce()
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
