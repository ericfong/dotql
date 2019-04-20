import _ from 'lodash'
import { createContext, useContext, useEffect, createElement } from 'react'

import useChange from './useChange'

export { useChange }

export const ProxyContext = createContext()
export const ProxyProvider = ({ proxy, children }) => createElement(ProxyContext.Provider, { value: proxy, children })
export const useProxy = () => useContext(ProxyContext)

export const useSnapshot = (args, option) => {
  const [current, change] = useChange({ loading: true })

  const proxy = useProxy()
  useEffect(() => {
    return proxy.onSnapshot(
      args,
      option,
      data => {
        change({ loading: false, data, error: null })
      },
      error => {
        change({ loading: false, data: null, error })
      }
    )
  }, [proxy, ...args]) // eslint-disable-line

  return current
}

export const useSnap = (...args) => useSnapshot(args).data

export const useOne = (...args) => _.find(useSnap(...args), (v, k) => k[0] !== '_' && k[0] !== '$')

const EMPTY_OBJ = {}
export const useSnapObj = (...args) => useSnap(...args) || EMPTY_OBJ
