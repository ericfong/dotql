import _ from 'lodash'

export const applyEnhancers = (target, enhancers) => {
  if (enhancers) {
    const flatEnhancers = _.isArray(enhancers) ? _.flattenDeep(enhancers) : [enhancers]
    _.forEach(flatEnhancers, enhancer => {
      enhancer(target)
    })
  }
  return target
}

export const fetchJson = (url, option = {}, fetchFunc = global.fetch) => {
  const headers = (option.headers = { Accept: 'application/json', 'Content-Type': 'application/json', ...option.headers })
  if (option.body) {
    option.method = option.method || 'POST'
    if (headers['Content-Type'] === 'application/json' && typeof option.body !== 'string') {
      option.body = JSON.stringify(option.body)
    }
  }
  return fetchFunc(url, option).then(res => {
    const type = res.headers.get('Content-Type')
    const promise = type.includes('/json') ? res.json() : type.includes('/text') ? res.text() : Promise.resolve(res)

    if (res.status >= 200 && res.status < 400) return promise

    // Fail http status
    return promise.then(data => {
      const error = new Error(`${(data && data.message) || res.statusText}`)
      Object.assign(error, { response: res, data })
      throw error
    })
  })
}
