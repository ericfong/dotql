import EventEmitter from 'eventemitter3'
import isPromise from 'p-is-promise'

export default class RxMap extends Map {
  constructor(iterable) {
    super(iterable)
    this.emitter = new EventEmitter()
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
  baseClear() {
    return super.clear()
  }

  set(key, value) {
    const oldValue = this.get(key)
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
    return hasDel
  }

  clear() {
    super.clear()
    const { emitter } = this
    emitter.eventNames().forEach(key => {
      emitter.emit(key, undefined)
    })
  }

  emit(key, value) {
    this.emitter.emit(key, value)
  }

  watch(key, onNext, option) {
    Promise.resolve(this.get(key, option)).then(onNext)
    this.emitter.on(key, onNext)
    return () => {
      this.emitter.removeListener(key, onNext)
    }
  }
}
