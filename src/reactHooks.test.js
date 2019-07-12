import { createContext } from 'react'
import { renderHook, act } from '@testing-library/react-hooks'
import { createUseWatch, RxMap } from '.'

test('RxMap: createUseWatch', async () => {
  const map = new RxMap()
  const Context = createContext(map)
  const useWatch = createUseWatch(Context)
  const useWatch2 = createUseWatch(Context, { fullState: true })
  const useWatch3 = createUseWatch(Context, { oneResult: true })

  const { result } = renderHook(() => {
    return {
      w1: useWatch('key01'),
      w2: useWatch2('key01'),
      w3: useWatch3('key01'),
    }
  })

  expect(result.current.w1).toBe(undefined)
  expect(result.current.w2).toEqual({ loading: true })
  expect(result.current.w3).toBe(undefined)
  act(() => {
    map.set('key01', 'value')
  })
  expect(result.current.w1).toBe('value')
  expect(result.current.w2).toEqual({ data: 'value', error: undefined, loading: false })
  expect(result.current.w3).toBe('value')
})
