import delay from 'delay'
import RxMap from './RxMap'

test('load and save', async () => {
  const m1 = new RxMap()
  m1.set('a', 'a1')
  m1.setMeta('a', { setAt: 'now' })

  const m2 = new RxMap()
  m2.restore(m1.extract())

  expect(m2.get('a')).toBe('a1')
  expect(m2.getMeta('a')).toEqual({ setAt: 'now' })
})

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
  // will not emit if no value set
  expect(watcher1).toBeCalledTimes(0)

  m.set('b', 'B')
  await delay()
  expect(watcher1).toBeCalledTimes(1)
  expect(watcher1).toBeCalledWith('B')

  const watcher2 = jest.fn()
  m.watch('b', watcher2)
  await delay()
  // first-emit if has value
  expect(watcher2).toBeCalledTimes(1)
  expect(watcher2).toBeCalledWith('B')

  m.set('b', 'B1')
  expect(watcher1).toBeCalledTimes(2)
  expect(watcher1).toBeCalledWith('B1')
  expect(watcher2).toBeCalledTimes(2)
  expect(watcher2).toBeCalledWith('B1')
})
