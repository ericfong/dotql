import _ from 'lodash'
import { createContext, useContext, useEffect, createElement, useState } from 'react'

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
  const [state, setState] = useState({ loading: true })

  const map = useRxMap()
  useEffect(() => {
    return map.watch(
      args,
      (data, promiseErr) => {
        setState({ loading: false, data, error: promiseErr })
      },
      option
    )
  }, [map, ...getMemArr(args)]) // eslint-disable-line

  return state
}
