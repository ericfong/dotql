export const timeoutFetch = (url, option = {}, _fetch = global.fetch) => Promise.race([
  _fetch(url, option),
  new Promise((x, reject) => {
    setTimeout(() => reject(new Error('Timeout')), option.timeout || 6000)
  }),
])

export const fetchWithTimeout = _fetch => (url, option) => timeoutFetch(url, option, _fetch)
