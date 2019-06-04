import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import RxMap from './RxMap'

const DEV = process.env.NODE_ENV !== 'production'

const singleAsync = (obj, key, asyncFunc) => {
  const doFunc = () => (obj[key] = asyncFunc().finally(() => {
    obj[key] = null
  }))

  const p = obj[key]
  if (p) {
    if (p.hasNext) {
      return p
    }
    p.hasNext = true
    return p.then(doFunc)
  }

  return doFunc()
}

export default class Client {
  // conf props: callServer, maxAge, channelsDidChange
  // ssrMode:true, .extract(), .restore(), ssr:false

  constructor(conf) {
    Object.assign(this, conf)
    if (!this.map) this.map = new RxMap()

    this.batchDebounce = _.debounce(() => this.batchCheck())
    if (this.channelsDidChange) {
      this.emitChannelsDidChangeDebounce = _.debounce(() => this.emitChannelsDidChange())
    }
  }

  /* #region utils  */
  toKey(spec, option) {
    if (option && option.key) return option.key
    const key = _.isString(spec) ? spec : stringify(spec)
    return (option.key = key)
  }

  setCache(key, promise, option) {
    this.map.set(key, promise)
    const maxAge = option.maxAge || this.maxAge
    this.map.setMeta(key, { expires: typeof maxAge === 'number' ? Date.now() + maxAge : undefined })
  }

  delete(key) {
    this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
  /* #endregion */

  // end-user-entry-point
  query(spec, option = {}) {
    if (option.cachePolicy === 'no-cache') {
      // no-cache for mutation (or network-only)
      return this.handle(spec, option)
    }

    const { map } = this
    const key = this.toKey(spec, option)

    // hit cache
    let oldCache
    if (map.has(key)) {
      oldCache = map.get(key)
      const expires = this.map.getMeta(key, 'expires')
      if (!(typeof expires === 'number' && Date.now() > expires)) {
        return oldCache
      }
    }

    const newPromise = this.handle(spec, option)
    this.setCache(key, newPromise, option)
    this.map.setMeta(key, { spec, option })
    return oldCache || newPromise
  }

  mutate(spec, option = {}) {
    spec.$mutation = spec.$mutation || 1
    option.cachePolicy = 'no-cache'
    return this.handle(spec, option)
  }

  // end-user-entry-point
  watch(spec, onNext, option = {}) {
    const key = this.toKey(spec, option)
    const hitCache = this.map.has(key)
    const p = this.query(spec, option)
    if (hitCache) Promise.resolve(p).then(onNext)
    // listen
    this.map.setMeta(key, { watchCount: (this.map.getMeta(key, 'watchCount') || 0) + 1, spec, option })
    const removeListener = this.map.listen(key, onNext)
    return () => {
      removeListener()
      --this.map.getMeta(key).watchCount
    }
  }

  callServer() {
    if (DEV) console.error('callServer function is missing')
  }

  batchings = []

  // middleware-point
  handle(spec, option) {
    this.batchings.push({ spec, option })
    this.batchDebounce()
    return new Promise((_resolve, _reject) => {
      option.resolve = _resolve
      option.reject = _reject
    })
  }

  batchCheck() {
    return this.batchings.length > 0 ? this.batchNow() : Promise.resolve()
  }

  batchNow() {
    return singleAsync(this, '_batchFlushPromise', async () => {
      const { batchings } = this
      this.batchings = []
      const restMetas = { ...this.map.getMetas() }

      const batchArr = []
      const batchOptions = []
      _.forEach(batchings, ({ spec, option }) => {
        batchArr.push({ spec })
        batchOptions.push(option)
        delete restMetas[option.key]
      })
      // attach rest of metas (they are watching)
      _.forEach(restMetas, meta => {
        if (meta.watchCount > 0) {
          batchArr.push({ spec: meta.spec, notMatch: meta.eTags })
          batchOptions.push(meta.option)
        }
      })

      // await server call
      const resBatch = (await this.callServer(batchArr, batchOptions)) || []

      _.forEach(batchOptions, (option, i) => {
        this.batchAccept(resBatch[i], option)
      })
    })
  }

  batchAccept(res, option) {
    const { key } = option
    if (option.resolve) {
      if (res.error) option.reject(res.error)
      else option.resolve(res.result)
      delete option.resolve
      delete option.reject
    } else if (res.error || res.result) {
      // no resolve means no direct query(), it is from watching
      const p = res.error ? Promise.reject(res.error) : Promise.resolve(res.result)
      this.setCache(key, p, option)
    }

    // record eTags (eTags == undefined means no change)
    if (res.eTags !== undefined) {
      this.map.setMeta(key, { eTags: res.eTags })
      if (this.channelsDidChange) this.emitChannelsDidChangeDebounce()
    }
  }

  emitChannelsDidChange() {
    if (this.channelsDidChange) {
      const newETags = _.transform(
        this.map.getMetas(),
        (acc, meta) => {
          _.assign(acc, meta.eTags)
        },
        {}
      )
      this.eTags = this.channelsDidChange(newETags, this.eTags || {}) || newETags
    }
  }
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

  expires?: Date;
}
// del metaKey if (watchCount === 0 || !resolve)
*/
