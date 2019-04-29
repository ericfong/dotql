import EventEmitter from 'eventemitter3'
import isPromise from 'p-is-promise'

export default class RxMap extends Map {
  constructor(iterable, conf) {
    super(iterable)
    if (conf) {
      Object.assign(this, conf)
    }
    this.emitter = new EventEmitter()
  }

  toKey(args) {
    return args
  }

  watch(args, onNext, option) {
    const key = this.toKey(args, option)
    Promise.resolve(this.get(args, option)).then(onNext)
    this.emitter.on(key, onNext)
    return () => {
      this.emitter.removeListener(key, onNext)
    }
  }

  get(args, option) {
    return this.baseGet(this.toKey(args, option))
  }

  set(args, value, option) {
    const key = this.toKey(args, option)
    const oldValue = this.baseGet(key)
    if (oldValue !== value) {
      this.baseSet(key, value)
      if (isPromise(value)) {
        value.then(v => this.baseEmit(key, v)).catch(err => this.baseEmit(key, undefined, err))
      } else {
        this.baseEmit(key, value)
      }
    }
    return this
  }

  delete(args, option) {
    const key = this.toKey(args, option)
    const hasDel = this.baseDelete(key)
    if (hasDel) {
      this.baseEmit(key, undefined)
    }
    return hasDel
  }

  has(args, option) {
    return this.baseHas(this.toKey(args, option))
  }

  clear() {
    this.baseClear()
    const { emitter } = this
    emitter.eventNames().forEach(key => {
      emitter.emit(key, undefined)
    })
  }

  baseEmit(key, value) {
    this.emitter.emit(key, value)
  }

  baseGet(key) {
    return super.get(key)
  }

  baseSet(key, value) {
    return super.set(key, value)
  }

  baseDelete(key) {
    return super.delete(key)
  }

  baseHas(key) {
    return super.has(key)
  }

  baseClear() {
    return super.clear()
  }
}
