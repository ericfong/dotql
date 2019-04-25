// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import { enhance } from '../util'
import RxMap from './RxMap'

export const withProxy = Base =>
  class Proxy extends Base {
    constructor(option) {
      super(option)
      Object.assign(this, option)
      this.map = this.map || new RxMap()
      this.setAts = {}
    }

    // apollo: cache-first, cache-and-network, network-only, cache-only, no-cache.   keyv: ttl || mem maxAge

    proxyCacheKey(args) {
      return _.isString(args) ? args : stringify(args)
    }

    set(args, value, option) {
      const key = this.proxyCacheKey(args)
      this.setAts[key] = new Date()
      return this.map.set(key, value, option)
    }

    // middleware-point
    handle(args, option, key) {
      return this.callServer(args, option, key)
    }

    // end-user-entry-point
    get(args, option = {}) {
      const key = this.proxyCacheKey(args)
      if (this.map.has(key, option)) return this.map.get(key, option)

      // assert(option.callServer, 'createProxy require callServer function')
      const promise = this.handle(args, option, key)

      this.set(key, promise, option)
      return promise
    }
    // end-user-entry-point
    query(args, option) {
      return this.get(args, option)
    }

    // end-user-entry-point
    watch(args, onNext, option) {
      return this.map.watch(this.proxyCacheKey(args), onNext, option)
    }
  }

export const withBatch = Base =>
  class Batch extends Base {
    constructor(option) {
      super(option)
      this.batchingSpecs = []
      this.batchingOptions = []
      this.batchingKeys = []
      this.batchingPromises = []
      this.batchDebounce = _.debounce(proxy => proxy.batchFlushToServer())
    }

    async batchFlushToServer() {
      const { batchingSpecs, batchingOptions, batchingKeys, batchingPromises } = this
      this.batchingSpecs = []
      this.batchingOptions = []
      this.batchingKeys = []
      this.batchingPromises = []
      // console.log('batchDebounce', batchingSpecs, batchingOptions, batchingKeys)

      const results = (await super.handle({ $batch: batchingSpecs }, batchingOptions, batchingKeys)) || []
      _.forEach(batchingPromises, (p, i) => {
        p.resolve(results[i])
      })
    }

    handle(spec, option, key) {
      this.batchingSpecs.push(spec)
      this.batchingOptions.push(option)
      this.batchingKeys.push(key)
      const pProps = {}
      const p = new Promise((_resolve, _reject) => {
        pProps.resolve = _resolve
        pProps.reject = _reject
      })
      Object.assign(p, pProps)
      this.batchingPromises.push(p)
      this.batchDebounce(this)
      return p
    }
  }

const defaultEnhancers = [withProxy, withBatch]

const createProxy = (option, enhancers = defaultEnhancers) => new (enhance(Object, enhancers))(option)
export default createProxy
