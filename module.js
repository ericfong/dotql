import { enhance } from './util'
import { RxMapContext, RxMapProvider, useRxMap } from './react/useRxMap'

export const ProxyContext = RxMapContext
export const ProxyProvider = RxMapProvider
export const useProxy = useRxMap
export { enhance }

// core
export { default as createServer } from './server/createServer'

// proxy
export { default as createProxy, withProxy, withBatch, defaultEnhancers } from './proxy/createProxy'
export { fetchJson } from './proxy/util'

// react
export { default as useChange } from './react/useChange'
export * from './react/useRxMap'
