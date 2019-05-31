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

const isDataField = k => k[0] !== '_' && k[0] !== '$'
export const fitOne = result => {
  if (!result) return result
  const keys = _.keys(result)
  const headKey = _.find(keys, isDataField)
  const lastKey = _.findLast(keys, isDataField)
  return headKey === lastKey ? result[headKey] : result
}

export const createUseWatch = (useMap, { one } = {}) => {
  let _useWatch = (args, option) => {
    const [state, setState] = useState({ loading: true })

    const map = useMap()
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
  if (one) {
    _useWatch = (args, option) => fitOne(_useWatch(args, option).data)
  }
  return _useWatch
}

export const useWatch = createUseWatch(useRxMap)
