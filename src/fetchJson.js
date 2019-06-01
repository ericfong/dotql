const fetchJson = (url, option = {}, fetchFunc = global.fetch) => {
  const headers = (option.headers = { Accept: 'application/json', ...option.headers })
  if (option.json) {
    headers['Content-Type'] = 'application/json'
    option.body = JSON.stringify(option.json)
  }
  if (option.body) {
    option.method = option.method || 'POST'
  }
  return fetchFunc(url, option).then(res => {
    const type = res.headers.get('Content-Type')
    const promise = type.includes('/json') ? res.json() : type.includes('/text') ? res.text() : Promise.resolve(res)

    if (res.ok) return promise

    // Fail http status
    return promise.then(data => {
      const error = new Error(`${(data && data.message) || res.statusText}`)
      Object.assign(error, { response: res, data })
      throw error
    })
  })
}

export default fetchJson
