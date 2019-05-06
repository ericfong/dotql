// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import RxMap from './RxMap'

class Proxy {
  constructor(conf = {}) {
    Object.assign(this, conf)
    if (!this.map) this.map = new RxMap()
    this.setAts = {}
    // meta = key: { args, option, setAt }
    // watchCount, eTag
    // resolve, reject, batchIndex (del eTag)
    // del metaKey if (watchCount === 0 || !resolve)
    this.metas = {}
    // this.batchingKeys = []
  }

  /* #region utils  */
  toKey(args, option) {
    if (option && option.key) return option.key
    const key = _.isString(args) ? args : stringify(args)
    return (option.key = key)
  }

  getCache = (args, option = {}) => {
    return this.map.get(this.toKey(args, option))
  }

  getMetas = () => this.metas

  setMeta = (key, values) => {
    const meta = this.metas[key]
    if (meta) Object.assign(meta, values)
  }

  metaCheckDelete(key) {
    const count = --this.metas[key].count
    if (count <= 0) {
      delete this.metas[key]
    }
  }
  /* #endregion */

  // middleware-point
  handle = (args, option) => {
    return this.callServer(args, option)
  }

  // end-user-entry-point
  query = (args, option = {}) => {
    if (option.cachePolicy === 'no-cache') {
      // no-cache for mutation (or network-only)
      return this.handle(args, option)
    }

    // watch or query-once (TODO use ttl/maxAge which should similar to apollo cache-and-network)
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
  watch = (args, onNext, option = {}) => {
    const key = this.toKey(args, option)
    Promise.resolve(this.query(args, option)).then(onNext)
    // listen
    const w = this.metas[key] || { count: 0 }
    this.metas[key] = { count: w.count + 1, args, option }

    const removeListener = this.map.listen(key, onNext)

    return () => {
      removeListener()
      this.metaCheckDelete(key)
    }
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
    _.forEach(proxy.getMetas(), (w, key) => {
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
      proxy.setMeta(batchedKeyArr[i], { eTag: w.eTag })
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
