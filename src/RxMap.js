import invariant from 'invariant'
import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import isPromise from 'p-is-promise'

const DEV = process.env.NODE_ENV !== 'production'

export default class RxMap extends Map {
  constructor(iterable) {
    super(iterable)
    this.emitter = new EventEmitter()
    this.metas = new Map()
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
    this.metas.delete(key)
    return hasDel
  }

  clear() {
    super.clear()
    const { emitter } = this
    emitter.eventNames().forEach(key => {
      emitter.emit(key, undefined)
    })
    this.metas.clear()
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
    const keyValues = {}
    this.metas.forEach((meta, key) => {
      keyValues[key] = meta
    })
    return keyValues
  }

  getMeta(key, path, defaultValue) {
    const meta = this.metas.get(key)
    return path ? _.get(meta, path, defaultValue) : meta || defaultValue
  }

  setMeta(key, values) {
    // if (!this.has(key)) return undefined
    if (DEV) invariant(this.has(key), `setMeta(${key}) which do not have main value`)
    const newMeta = _.assign(this.metas.get(key) || {}, values)
    this.metas.set(key, newMeta)
  }
}
