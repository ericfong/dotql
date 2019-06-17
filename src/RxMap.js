import invariant from 'invariant'
import _ from 'lodash'
import EventEmitter from 'eventemitter3'
import isPromise from 'p-is-promise'

const DEV = process.env.NODE_ENV !== 'production'

export const firstEmit = (host, key, onNext, getFunc) => {
  const has = host.has(key)
  const p = getFunc()
  if (has) {
    Promise.resolve(p)
      .then(onNext)
      .catch(err => onNext(undefined, err))
  }
}

export default class RxMap {
  constructor() {
    this.emitter = new EventEmitter()
    this.map = new Map()
    this.metas = new Map()
  }

  has(key) {
    return this.map.has(key)
  }

  get(key) {
    return this.map.get(key)
  }

  watch(key, onNext) {
    firstEmit(this, key, onNext, () => this.map.get(key))
    return this.listen(key, onNext)
  }

  set(key, value) {
    const oldValue = this.map.get(key)
    if (oldValue !== value) {
      this.map.set(key, value)
      if (isPromise(value)) {
        value.then(v => this.emitter.emit(key, v)).catch(err => this.emitter.emit(key, undefined, err))
      } else {
        this.emitter.emit(key, value)
      }
    }
    return this
  }

  delete(key) {
    const hasDel = this.map.delete(key)
    if (hasDel) {
      this.emitter.emit(key, undefined)
    }
    this.metas.delete(key)
    return hasDel
  }

  clear() {
    this.map.clear()
    const { emitter } = this
    emitter.eventNames().forEach(key => {
      emitter.emit(key, undefined)
    })
    this.metas.clear()
  }

  emit(key, value) {
    this.emit(key, value)
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

  // extract & restore

  extract() {
    return {
      map: [...this.map],
      metas: [...this.metas],
    }
  }

  restore(saved) {
    this.map = new Map(saved.map)
    this.metas = new Map(saved.metas)
  }
}
