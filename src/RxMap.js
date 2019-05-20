import invariant from 'invariant'
import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import isPromise from 'p-is-promise'

const DEV = process.env.NODE_ENV !== 'production'

export default class RxMap extends Map {
  constructor(iterable) {
    super(iterable)
    this.emitter = new EventEmitter()
    this.metas = {}
  }

  watch(key, onNext) {
    Promise.resolve(this.get(key)).then(onNext)
    return this.listen(key, onNext)
  }

  set(key, value) {
    const oldValue = super.get(key)
    if (oldValue !== value) {
      super.set(key, value)
      if (isPromise(value)) {
        value.then(v => this.emit(key, v)).catch(err => this.emit(key, undefined, err))
      } else {
        this.emit(key, value)
      }
    }
    return this
  }

  delete(key) {
    const hasDel = super.delete(key)
    if (hasDel) {
      this.emit(key, undefined)
    }
    delete this.metas[key]
    return hasDel
  }

  clear() {
    super.clear()
    const { emitter } = this
    emitter.eventNames().forEach(key => {
      emitter.emit(key, undefined)
    })
    this.metas = {}
  }

  emit(key, value) {
    this.emitter.emit(key, value)
  }

  listen(key, onNext) {
    const { emitter } = this
    emitter.on(key, onNext)
    return () => {
      emitter.removeListener(key, onNext)
    }
  }

  // metas

  getMetas() {
    return this.metas
  }

  getMeta(...args) {
    return _.get(this.metas, args)
  }

  setMeta(key, values) {
    // if (!this.has(key)) return undefined
    if (DEV) invariant(this.has(key), `setMeta(${key}) which do not have main value`)
    return (this.metas[key] = Object.assign(this.metas[key] || {}, values))
  }

  // updateMeta(key, values) {
  //   return Object.assign(this.metas[key], values)
  // }
}
