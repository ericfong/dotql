// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'
import EventEmitter from 'events'
import isPromise from 'p-is-promise'

import { enhance } from '../util'

const proxyFuncs = {
  getCache(key) {
    const { map } = this
    const cache = map.get(key)
    return cache ? cache.data : undefined
  },

  setCache(key, promise) {
    const { map, emitter } = this
    // resolve data to output???
    const cache = {
      data: promise,
      // maxAge: Date.now() + options.maxAge,
    }
    map.set(key, cache)

    if (isPromise(promise)) {
      // Remove rejected promises from cache
      // promise.catch(() => map.delete(key))
      promise.then(data => emitter.emit(key, data))
    } else {
      emitter.emit(key, promise)
    }
    return promise
  },

  // ----------------------------------------------------------------------------------------------
  // cache-first, cache-and-network, network-only, cache-only, no-cache
  // keyv ttl || mem maxAge

  getByKey(key, args, option) {
    const cachedVal = this.getCache(key, option)
    if (cachedVal !== undefined) return cachedVal

    // assert(option.callServer, 'createProxy require callServer function')
    const promise = this.callServer(args, option, key)

    return this.setCache(key, promise, option)
  },

  getCacheKey(args) {
    return _.isString(args) ? args : stringify(args)
  },

  // two main entry point for end-user
  query(args, option = {}) {
    const key = this.getCacheKey(args)
    return this.getByKey(key, args, option)
  },

  // two main entry point for end-user
  onSnapshot(args, option, onNext /* , onError, onCompletion */) {
    const { emitter } = this
    const key = this.getCacheKey(args)
    Promise.resolve(this.getByKey(key, args, option)).then(onNext)
    emitter.on(key, onNext)
    return () => {
      emitter.removeListener(key, onNext)
    }
  },

  // ----------------------------------------------------------------------------------------------
}

const createProxy = (option, enhancers) => {
  // use map interface to compatible with keyv and quick-lru
  const proxy = { ...option, map: option.map || new Map(), emitter: option.emitter || new EventEmitter(), ...proxyFuncs }
  return enhance(proxy, enhancers)
}
export default createProxy
