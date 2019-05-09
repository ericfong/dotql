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
const isDataField = k => k[0] !== '_' && k[0] !== '$'
const fitOne = result => {
  if (!result) return result
  const keys = _.keys(result)
  const headKey = _.find(keys, isDataField)
  const lastKey = _.findLast(keys, isDataField)
  return headKey === lastKey ? result[headKey] : result
}

export const useOne = (spec, option) => fitOne(useWatch(spec, option).data)

export const useMutate = () => {
  const map = useRxMap()
  return (spec, option) => {
    return map.mutate(spec, option).then(result => fitOne(result))
  }
}
