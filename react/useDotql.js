import _ from 'lodash'
import { createElement } from 'react'

import { RxMapContext, RxMapProvider, useRxMap, useWatch } from './useRxMap'

export { default as useChange } from './useChange'
export * from './useRxMap'

// rename useRxMap
export const ProxyContext = RxMapContext
export const ProxyProvider = ({ proxy, map, children }) => createElement(RxMapProvider, { map: proxy || map, children })
export const useProxy = useRxMap

// helpers and mutation
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
