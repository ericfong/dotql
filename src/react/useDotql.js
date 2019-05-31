import _ from 'lodash'
import { createElement, useMemo } from 'react'

import { RxMapContext, RxMapProvider, useRxMap, useWatch } from './useRxMap'

export * from './useRxMap'

// rename useRxMap
export const DotqlContext = RxMapContext
export const DotqlProvider = ({ client, children }) => createElement(RxMapProvider, { map: client, children })
export const useDotql = useRxMap

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

export const useMutate = (func, deps = []) => {
  const dotql = useDotql()
  return useMemo(() => {
    const mutate = (spec, option) => dotql.mutate(spec, option).then(result => fitOne(result))
    return func ? (...args) => func(mutate, ...args) : mutate
  }, deps)
}
