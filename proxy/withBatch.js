import _ from 'lodash'

const withBatch = base => {
  return {
    ...base,

    batchingSpecs: [],
    batchingOptions: [],
    batchingKeys: [],
    batchingPromises: [],

    async batchFlushToServer() {
      const { batchingSpecs, batchingOptions, batchingKeys, batchingPromises } = this
      this.batchingSpecs = []
      this.batchingOptions = []
      this.batchingKeys = []
      this.batchingPromises = []
      // console.log('batchDebounce', batchingSpecs, batchingOptions, batchingKeys)

      const results = (await base.callServer({ $batch: batchingSpecs }, batchingOptions, batchingKeys)) || []
      _.forEach(batchingPromises, (p, i) => {
        p.resolve(results[i])
      })
    },

    batchDebounce: _.debounce(proxy => proxy.batchFlushToServer()),

    callServer(spec, option, key) {
      this.batchingSpecs.push(spec)
      this.batchingOptions.push(option)
      this.batchingKeys.push(key)
      const p = {}
      p.promise = new Promise((resolve, reject) => {
        p.resolve = resolve
        p.reject = reject
      })
      this.batchingPromises.push(p)
      this.batchDebounce(this)
      return p.promise
    },
  }
}

export default withBatch
