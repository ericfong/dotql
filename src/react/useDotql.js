import _ from 'lodash'
import { createElement, useMemo } from 'react'

import { RxMapContext, RxMapProvider, useRxMap, createUseWatch, fitOne } from './useRxMap'

export * from './useRxMap'

// rename useRxMap
export const DotqlContext = RxMapContext
export const DotqlProvider = ({ client, children }) => createElement(RxMapProvider, { map: client, children })
export const useDotql = useRxMap

// helpers and mutation

export const useOne = createUseWatch(useRxMap, { one: true })

export const useMutate = (func, deps = []) => {
  const dotql = useDotql()
  return useMemo(() => {
    const mutate = (spec, option) => dotql.mutate(spec, option).then(result => fitOne(result))
    return func ? (...args) => func(mutate, ...args) : mutate
  }, deps)
}
