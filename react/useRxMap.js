import _ from 'lodash'
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

const findOne = result => _.find(result, (v, k) => k[0] !== '_' && k[0] !== '$')

export const useOne = (...args) => findOne(useWatch(...args))

export const useMutateWithOption = () => {
  const map = useRxMap()
  return (args, option) => {
    return map.query(args, { ...option, cachePolicy: 'no-cache' })
  }
}

export const useMutate = () => {
  const map = useRxMap()
  return (...args) => {
    return map.query(args, { cachePolicy: 'no-cache' }).then(result => findOne(result))
  }
}
