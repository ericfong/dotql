import _ from 'lodash'

const createError = (msg, values) => {
  const error = new Error(msg)
  Object.assign(error, values)
  return error
}

export const jsonFetch = (url, option = {}, _fetch = global.fetch) => {
  const headers = (option.headers = { Accept: 'application/json', ...option.headers })
  if (option.json || _.isPlainObject(option.body)) {
    headers['Content-Type'] = 'application/json'
    option.body = JSON.stringify(option.json || option.body)
  }
  if (option.body) {
    option.method = option.method || 'POST'
  }
  option.credentials = option.credentials || 'include'

  return _fetch(url, option).then(res => {
    const type = res.headers.get('Content-Type')

    // response content is JSON
    if (type.includes('/json')) {
      return res.text().then(text => {
        try {
          const data = JSON.parse(text)
          // prevent apollo client "Failed to execute 'text' on 'Response': body stream is locked"
          res.text = () => Promise.resolve(text)
          res.json = () => Promise.resolve(data)

          if (res.ok) {
            return Object.assign(res, { data })
          }
          throw createError(`${(data && data.message) || res.statusText}`, { response: res, data, text })
        } catch (err) {
          throw Object.assign(err, { response: res, text })
        }
      })
    }

    if (res.ok) return res
    throw createError(`${res.statusText}`, { response: res })
  })
}

export const fetchWithJson = _fetch => (url, option) => jsonFetch(url, option, _fetch)
export const makeJsonFetch = fetchWithJson

export const shortcutJsonResponse = res => res.data || res

export const fetchJson = (url, option, _fetch) => jsonFetch(url, option, _fetch).then(shortcutJsonResponse)
