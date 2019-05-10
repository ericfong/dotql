import _ from 'lodash'
import { createContext, useContext, useEffect, createElement } from 'react'

import useChange from './useChange'

export const RxMapContext = createContext()
export const RxMapProvider = ({ map, children }) => createElement(RxMapContext.Provider, { value: map, children })
export const useRxMap = () => useContext(RxMapContext)

const getMemArr = args => {
  if (_.isArray(args)) return args
  if (_.isPlainObject(args)) {
    return _.keys(args)
      .sort()
      .map(k => args[k])
  }
  return [args]
}

export const useWatch = (args, option) => {
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
  }, [map, ...getMemArr(args)]) // eslint-disable-line

  return current
}
