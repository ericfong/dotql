const createError = (msg, values) => {
  const error = new Error(msg)
  Object.assign(error, values)
  return error
}

export const makeJsonFetch = doFetch => {
  return (url, option = {}) => {
    const headers = (option.headers = { Accept: 'application/json', ...option.headers })
    if (option.json) {
      headers['Content-Type'] = 'application/json'
      option.body = JSON.stringify(option.json)
    }
    if (option.body) {
      option.method = option.method || 'POST'
    }

    option.credentials = option.credentials || 'include'

    return doFetch(url, option).then(res => {
      const type = res.headers.get('Content-Type')

      // response content is JSON
      if (type.includes('/json')) {
        return res.json().then(data => {
          if (res.ok) {
            return Object.assign(res, { data })
          }
          throw createError(`${(data && data.message) || res.statusText}`, { response: res, data })
        })
      }

      if (res.ok) return res
      throw createError(`${res.statusText}`, { response: res })
    })
  }
}

const fetchJson = (url, option, fetchFunc = global.fetch) => {
  return makeJsonFetch(fetchFunc)(url, option).then(res => res.data)
}

export default fetchJson
