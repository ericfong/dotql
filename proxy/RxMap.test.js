import delay from 'delay'
import RxMap from './RxMap'

test('get, set, watch', async () => {
  const m = new RxMap()
  // get, set
  expect(m.get('a')).toBe(undefined)
  m.set('a', 1)
  expect(m.get('a')).toBe(1)

  // watch
  const watcher1 = jest.fn()
  m.watch('b', watcher1)
  await delay()
  expect(watcher1).toBeCalledTimes(1)
  // return get result
  expect(watcher1).toBeCalledWith(undefined)

  m.set('b', 'B')
  await delay()
  expect(watcher1).toBeCalledTimes(2)
  expect(watcher1).toBeCalledWith('B')
})
