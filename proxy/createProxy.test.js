// import _ from 'lodash'
import delay from 'delay'

import createProxy from './createProxy'

test('watching', async () => {
  const callServer = jest.fn(req => {
    return { $batch: req.$batch.map(w => ({ result: w.args, eTag: `${w.args}-eTag` })) }
  })
  const proxy = createProxy({ callServer })
  const remove1 = proxy.watch('A', () => {})
  const remove2 = proxy.watch('A', () => {})
  expect(proxy.getMetas()).toEqual({
    A: { args: 'A', count: 2, option: { key: 'A' } },
  })

  await delay()
  expect(callServer).lastCalledWith({ $batch: [{ args: 'A' }] }, [{ key: 'A' }])

  const remove3 = proxy.watch('B', () => {})
  expect(proxy.getMetas()).toEqual({
    A: { args: 'A', count: 2, option: { key: 'A' }, eTag: 'A-eTag' },
    B: { args: 'B', count: 1, option: { key: 'B' } },
  })

  await delay()
  expect(callServer).lastCalledWith({ $batch: [{ args: 'B' }, { args: 'A', notMatch: 'A-eTag' }] }, [{ key: 'B' }])

  await proxy.batchFlushToServer(true)
  expect(callServer).lastCalledWith({ $batch: [{ args: 'A', notMatch: 'A-eTag' }, { args: 'B', notMatch: 'B-eTag' }] }, [])

  remove1()
  remove2()
  remove3()
  expect(proxy.getMetas()).toEqual({})
})

test('batch', async () => {
  const callServer = jest.fn(req => {
    return { $batch: req.$batch.map(s => ({ result: s.args.toLowerCase() })) }
  })
  const proxy = createProxy({ callServer })
  const p1 = proxy.query('A')
  const p2 = proxy.query('B')
  expect(await Promise.all([p1, p2])).toEqual(['a', 'b'])
  expect(callServer).toBeCalledTimes(1)
  expect(callServer).lastCalledWith({ $batch: [{ args: 'A' }, { args: 'B' }] }, [{ key: 'A' }, { key: 'B' }])
})
