// import _ from 'lodash'
import delay from 'delay'

import Client from './Client'

test('watching', async () => {
  const callServer = jest.fn(req => {
    return req.map(w => ({ result: w.spec, eTags: { k1: `${w.spec}-eTag` } }))
  })
  const client = new Client({ callServer })
  const remove1 = client.watch('A', () => {})
  const remove2 = client.watch('A', () => {})
  expect(client.map.metas).toMatchObject({
    A: { spec: 'A', watchCount: 2, option: { key: 'A' } },
  })

  await delay()
  expect(callServer).lastCalledWith([{ spec: 'A' }], [{ key: 'A' }])

  const remove3 = client.watch('B', () => {})
  expect(client.map.metas).toMatchObject({
    A: { spec: 'A', watchCount: 2, option: { key: 'A' }, eTags: { k1: 'A-eTag' } },
    B: { spec: 'B', watchCount: 1, option: { key: 'B' } },
  })

  await delay()
  expect(callServer).lastCalledWith([{ spec: 'B' }, { spec: 'A', notMatch: { k1: 'A-eTag' } }], [{ key: 'B' }, { key: 'A' }])

  await client.batchNow()
  expect(callServer).lastCalledWith(
    [{ spec: 'A', notMatch: { k1: 'A-eTag' } }, { spec: 'B', notMatch: { k1: 'B-eTag' } }],
    [{ key: 'A' }, { key: 'B' }]
  )

  remove1()
  remove2()
  remove3()
  expect(client.map.metas).toMatchObject({
    A: { spec: 'A', watchCount: 0, eTags: { k1: 'A-eTag' } },
    B: { spec: 'B', watchCount: 0, eTags: { k1: 'B-eTag' } },
  })
})

test('batch', async () => {
  const callServer = jest.fn(req => {
    return req.map(s => ({ result: s.spec.toLowerCase() }))
  })
  const client = new Client({ callServer })
  const p1 = client.query('A')
  const p2 = client.query('B')
  expect(await Promise.all([p1, p2])).toEqual(['a', 'b'])
  expect(callServer).toBeCalledTimes(1)
  expect(callServer).lastCalledWith([{ spec: 'A' }, { spec: 'B' }], [{ key: 'A' }, { key: 'B' }])
})
