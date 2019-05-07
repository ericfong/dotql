import { createContext, useContext, useEffect, createElement } from 'react'

import useChange from './useChange'

export const RxMapContext = createContext()
export const RxMapProvider = ({ map, children }) => createElement(RxMapContext.Provider, { value: map, children })
export const useRxMap = () => useContext(RxMapContext)

export const useWatchWithOption = (args, option) => {
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

export const useWatch = (...args) => useWatchWithOption(args).data
