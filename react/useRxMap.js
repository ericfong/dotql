import _ from 'lodash'
import { createContext, useContext, useEffect, createElement } from 'react'

import useChange from './useChange'

export const RxMapContext = createContext()
export const RxMapProvider = ({ map, children }) => createElement(RxMapContext.Provider, { value: map, children })
export const useRxMap = () => useContext(RxMapContext)

export const useWatchPromise = (args, option) => {
  const [current, change] = useChange({ loading: true })

  const map = useRxMap()
  useEffect(() => {
    return map.watch(
      args,
      (data, promiseErr) => {
        change({ loading: false, data, error: promiseErr })
      },
      option
    )
  }, [map, ...args]) // eslint-disable-line

  return current
}

export const useWatch = (...args) => useWatchPromise(args).data

export const useOne = (...args) => _.find(useWatch(...args), (v, k) => k[0] !== '_' && k[0] !== '$')
