// import assert from 'assert'
import _ from 'lodash'
import stringify from 'fast-stable-stringify'

import { enhance } from '../util'
import RxMap from './RxMap'

export const withProxy = Base => class Proxy extends Base {
  constructor(option = {}) {
    super(option.map)
    Object.assign(this, option)
    this.setAts = {}
  }

  // apollo: cache-first, cache-and-network, network-only, cache-only, no-cache.   keyv: ttl || mem maxAge

  toKey(args, option) {
    if (_.isString(args)) return args
    if (option && option.key) return option.key
    const key = stringify(args)
    return (option.key = key)
  }

  set(args, value, option) {
    const key = this.toKey(args, option)
    this.setAts[key] = new Date()
    return super.set(args, value, option)
  }

  // middleware-point
  handle(args, option) {
    return this.callServer(args, option)
  }

  // end-user-entry-point
  get(args, option = {}) {
    if (super.has(args, option)) return super.get(args, option)

    // assert(option.callServer, 'createProxy require callServer function')
    const promise = this.handle(args, option)

    super.set(args, promise, option)
    return promise
  }

  // end-user-entry-point
  query(args, option) {
    return this.get(args, option)
  }

  // end-user-entry-point
  // watch(args, onNext, option) {
  //   return super.watch(args, onNext, option)
  // }
}

export const withBatch = Base => class Batch extends Base {
  constructor(option) {
    super(option)
    this.batchingSpecs = []
    this.batchingOptions = []
    this.batchingPromises = []
    this.batchDebounce = _.debounce(proxy => proxy.batchFlushToServer())
  }

  async batchFlushToServer() {
    const { batchingSpecs, batchingOptions, batchingPromises } = this
    this.batchingSpecs = []
    this.batchingOptions = []
    this.batchingPromises = []
    // console.log('batchDebounce', batchingSpecs, batchingOptions)

    const { $batch: results = [] } = (await super.handle({ $batch: batchingSpecs }, batchingOptions)) || {}
    _.forEach(batchingPromises, (p, i) => {
      p.resolve(results[i])
    })
  }

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
  }
}

export const defaultEnhancers = [withProxy, withBatch]

const createProxy = (option, enhancers = defaultEnhancers) => new (enhance(RxMap, enhancers))(option)
export default createProxy
