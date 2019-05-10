import EventEmitter from 'eventemitter3'
import isPromise from 'p-is-promise'

export default class RxMap extends Map {
  constructor(iterable) {
    super(iterable)
    this.emitter = new EventEmitter()
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

  listen(key, onNext) {
    const { emitter } = this
    emitter.on(key, onNext)
    return () => {
      emitter.removeListener(key, onNext)
    }
  }
}
