// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import RxMap from './RxMap'
import { applyEnhancers } from './util'

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

export default class Proxy {
  constructor(conf) {
    Object.assign(this, conf)
    if (!this.map) this.map = new RxMap()
    this.metas = {}
  }

  /* #region utils  */
  toKey(spec, option) {
    if (option && option.key) return option.key
    const key = _.isString(spec) ? spec : stringify(spec)
    return (option.key = key)
  }

  getCache = (spec, option = {}) => {
    return this.map.get(this.toKey(spec, option))
  }

  setMeta = (key, values) => (this.metas[key] = Object.assign(this.metas[key] || {}, values))

  updateMeta = (key, values) => Object.assign(this.metas[key], values)
  /* #endregion */

  // end-user-entry-point
  query = (spec, option = {}) => {
    if (option.cachePolicy === 'no-cache') {
      // no-cache for mutation (or network-only)
      return this.handle(spec, option)
    }

    // watch or query-once (TODO use ttl/maxAge which should similar to apollo cache-and-network)
    const { map } = this
    const key = this.toKey(spec, option)
    if (map.has(key)) return map.get(key)

    // assert(option.callServer, 'createProxy require callServer function')
    const promise = this.handle(spec, option)

    map.set(key, promise)
    this.setMeta(key, { setAt: new Date() })
    return promise
  }

  mutate(spec, option = {}) {
    spec.$type = 'Mutations'
    option.cachePolicy = 'no-cache'
    return this.handle(spec, option)
  }

  // end-user-entry-point
  watch = (spec, onNext, option = {}) => {
    const key = this.toKey(spec, option)
    Promise.resolve(this.query(spec, option)).then(onNext)
    // listen
    this.setMeta(key, { watchCount: _.get(this.metas, [key, 'watchCount'], 0) + 1, spec, option })
    const removeListener = this.map.listen(key, onNext)
    return () => {
      removeListener()
      --this.metas[key].watchCount
    }
  }

  // middleware-point
  handle = (spec, option) => {
    const key = this.toKey(spec, option)

    this.batchingKeys.push(key)
    const meta = this.setMeta(key, { spec, option, eTags: null })
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
    const metas = { ...this.metas }

    const $batch = _.map(batchingKeys, key => {
      const meta = metas[key]
      delete metas[key]
      return { spec: meta.spec }
    })

    // attach rest of metas (they are watching)
    _.forEach(metas, (meta, key) => {
      if (meta.watchCount > 0) {
        batchingKeys.push(key)
        $batch.push({ spec: meta.spec, notMatch: meta.eTags })
      }
    })

    // await server call
    const res = (await this.callServer({ $batch })) || {}
    const resBatch = res.$batch || []

    const curMetas = this.metas
    _.forEach(batchingKeys, (key, i) => {
      const resItem = resBatch[i]
      const meta = curMetas[key]
      if (meta.resolve) {
        if (resItem.error) meta.reject(resItem.error)
        else meta.resolve(resItem.result)
        delete meta.resolve
        delete meta.reject
      }
      meta.eTags = resItem.eTags
    })
  })
}

/*
interface Meta {
  watchCount?: number;
  spec?: object;
  option?: object;
  eTags?: string;

  resolve: function;
  reject: function;
  // no eTags if new no-cache

  setAt?: Date;
}
// del metaKey if (watchCount === 0 || !resolve)
*/

export const createProxy = (option, enhancers) => applyEnhancers(new Proxy(option), enhancers)
