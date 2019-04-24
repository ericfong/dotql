import EventEmitter from 'events'
import isPromise from 'p-is-promise'

export default class RxMap {
  constructor(option) {
    this.map = option.map || new Map()
    this.emitter = option.emitter || new EventEmitter()
  }

  get(key) {
    const cache = this.map.get(key)
    return cache ? cache.data : undefined
  }

  set(key, data) {
    const { map, emitter } = this
    if (data === undefined) {
      map.delete(key)
    } else {
      map.set(key, { data, setAt: Date() })
    }

    if (isPromise(data)) {
      // Remove rejected promises from cache
      // data.catch(() => map.delete(key))
      data.then(data => emitter.emit(key, data))
    } else {
      emitter.emit(key, data)
    }
    return data
  }

  delete(key) {
    this.set(key, undefined)
  }

  clear() {
    const keys = [...this.map.keys()]
    this.map.clear()
    keys.forEach(key => {
      this.emitter.emit(key, undefined)
    })
  }

  watch(key, onNext /* , onError, onCompletion */) {
    Promise.resolve(this.get(key)).then(onNext)
    this.emitter.on(key, onNext)
    return () => {
      this.emitter.removeListener(key, onNext)
    }
  }
}
