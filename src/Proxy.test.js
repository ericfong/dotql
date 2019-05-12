// import _ from 'lodash'
import delay from 'delay'

import { createProxy } from './Proxy'

test('watching', async () => {
  const callServer = jest.fn(req => {
    return req.map(w => ({ result: w.spec, eTags: { k1: `${w.spec}-eTag` } }))
  })
  const proxy = createProxy({ callServer })
  const remove1 = proxy.watch('A', () => {})
  const remove2 = proxy.watch('A', () => {})
  expect(proxy.metas).toMatchObject({
    A: { spec: 'A', watchCount: 2, option: { key: 'A' } },
  })

  await delay()
  expect(callServer).lastCalledWith([{ spec: 'A' }])

  const remove3 = proxy.watch('B', () => {})
  expect(proxy.metas).toMatchObject({
    A: { spec: 'A', watchCount: 2, option: { key: 'A' }, eTags: { k1: 'A-eTag' } },
    B: { spec: 'B', watchCount: 1, option: { key: 'B' } },
  })

  await delay()
  expect(callServer).lastCalledWith([{ spec: 'B' }, { spec: 'A', notMatch: { k1: 'A-eTag' } }])

  await proxy.batchNow()
  expect(callServer).lastCalledWith([{ spec: 'A', notMatch: { k1: 'A-eTag' } }, { spec: 'B', notMatch: { k1: 'B-eTag' } }])

  remove1()
  remove2()
  remove3()
  expect(proxy.metas).toMatchObject({
    A: { spec: 'A', watchCount: 0, eTags: { k1: 'A-eTag' } },
    B: { spec: 'B', watchCount: 0, eTags: { k1: 'B-eTag' } },
  })
})

test('batch', async () => {
  const callServer = jest.fn(req => {
    return req.map(s => ({ result: s.spec.toLowerCase() }))
  })
  const proxy = createProxy({ callServer })
  const p1 = proxy.query('A')
  const p2 = proxy.query('B')
  expect(await Promise.all([p1, p2])).toEqual(['a', 'b'])
  expect(callServer).toBeCalledTimes(1)
  expect(callServer).lastCalledWith([{ spec: 'A' }, { spec: 'B' }])
})
