// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import RxMap from './RxMap'

const singleAsync = (obj, key, asyncFunc) => {
  const wrappedFunc = (...args) => {
    let p = obj[key]
    if (p) {
      if (p.hasNext) {
        return p
      }
      p.hasNext = true
      return p.then(() => {
        return wrappedFunc(...args)
      })
    }

    p = asyncFunc(...args)
    obj[key] = p
    p.finally(() => {
      obj[key] = null
    })
    return p
  }
  return wrappedFunc
}

class Proxy {
  constructor(conf) {
    Object.assign(this, conf)
    if (!this.map) this.map = new RxMap()
    this.metas = {}
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
  /* #endregion */

  /* #region metas  */
  getMetas = () => this.metas

  setMeta = (key, values) => (this.metas[key] = Object.assign(this.metas[key] || {}, values))

  updateMeta = (key, values) => Object.assign(this.metas[key], values)
  /* #endregion */

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
    this.setMeta(key, { setAt: new Date() })
    return promise
  }

  // end-user-entry-point
  watch = (args, onNext, option = {}) => {
    const key = this.toKey(args, option)
    Promise.resolve(this.query(args, option)).then(onNext)
    // listen
    const w = this.metas[key] || { watchCount: 0 }
    this.metas[key] = { ...w, watchCount: w.watchCount + 1, args, option }

    const removeListener = this.map.listen(key, onNext)
    return () => {
      removeListener()
      --this.metas[key].watchCount
    }
  }

  // middleware-point
  handle = (args, option) => {
    const key = this.toKey(args, option)

    this.batchingKeys.push(key)
    const meta = this.setMeta(key, { args, option, eTag: null })
    this.batchDebounce()

    return new Promise((_resolve, _reject) => {
      meta.resolve = _resolve
      meta.reject = _reject
    })
  }

  batchingKeys = []

  batchDebounce = _.debounce(() => {
    if (this.batchingKeys.length > 0) this.batchFlushToServer()
  })

  batchFlushToServer = singleAsync(this, '_batchFlushPromise', async () => {
    const { batchingKeys } = this
    this.batchingKeys = []
    const metas = { ...this.getMetas() }

    const $batch = _.map(batchingKeys, key => {
      const meta = metas[key]
      delete metas[key]
      return { args: meta.args }
    })

    // attach rest of metas (they are watching)
    _.forEach(metas, (meta, key) => {
      if (meta.watchCount > 0) {
        batchingKeys.push(key)
        $batch.push({ args: meta.args, notMatch: meta.eTag })
      }
    })

    // await server call
    const res = (await this.callServer({ $batch })) || {}
    const resBatch = res.$batch || []

    const curMetas = this.getMetas()
    _.forEach(batchingKeys, (key, i) => {
      const resItem = resBatch[i]
      const meta = curMetas[key]
      if (meta.resolve) {
        if (resItem.error) meta.resolve(resItem.error)
        else meta.reject(resItem.result)
        delete meta.resolve
        delete meta.reject
      }
      meta.eTag = resItem.eTag
    })
  })
}

/*
interface Meta {
  watchCount?: number;
  args?: object;
  option?: object;
  eTag?: string;

  resolve: function;
  reject: function;
  // no eTag if new no-cache

  setAt?: Date;
}
// del metaKey if (watchCount === 0 || !resolve)
*/

export const defaultEnhancers = []

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
