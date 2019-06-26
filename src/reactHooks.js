import _ from 'lodash'
import { createElement, useMemo, createContext, useContext, useEffect, useState } from 'react'

const getMemArr = args => {
  if (_.isArray(args)) return args
  if (_.isPlainObject(args)) {
    return _.keys(args)
      .sort()
      .map(k => args[k])
  }
  return [args]
}

const isDataField = k => k[0] !== '_' && k[0] !== '$'
export const fitOne = data => {
  if (!data) return data
  const keys = _.keys(data)
  const headKey = _.find(keys, isDataField)
  const lastKey = _.findLast(keys, isDataField)
  return headKey === lastKey ? data[headKey] : data
}

export const createUseWatch = (Context, { fullState, oneResult } = {}) => {
  const isFull = fullState && !oneResult
  return (args, option) => {
    const client = useContext(Context)
    const [state, setState] = useState(() => (isFull ? { loading: true } : undefined))
    useEffect(() => {
      return client.watch(
        args,
        (data, error) => {
          if (oneResult) {
            setState(fitOne(data))
          } else {
            setState(fullState ? { loading: false, data, error } : data)
          }
        },
        option
      )
    }, [client, ...getMemArr(args)])
    return state
  }
}

export const DotqlContext = createContext()

// helpers and mutation
export const useOne = createUseWatch(DotqlContext, { oneResult: true })

export const DotqlProvider = ({ client, children }) => createElement(DotqlContext.Provider, { value: client, children })
export const useDotql = () => useContext(DotqlContext)

export const useMutate = (func, deps) => {
  const dotql = useDotql()
  return useMemo(() => {
    const mutate = (spec, option) => dotql.mutate(spec, option).then(result => fitOne(result))
    return func ? (...args) => func(mutate, ...args) : mutate
  }, deps)
}
