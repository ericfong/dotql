// import _ from 'lodash'
// import delay from 'delay'

import createProxy from './createProxy'
import defaultEnhancers from './defaultEnhancers'

test('batch', async () => {
  const callServer = jest.fn(specs => {
    return specs.$batch.map(s => s.toLowerCase())
  })
  const proxy = createProxy({ callServer }, defaultEnhancers)
  const p1 = proxy.query('A')
  const p2 = proxy.query('B')
  expect(await Promise.all([p1, p2])).toEqual(['a', 'b'])
  expect(callServer).toBeCalledTimes(1)
  expect(callServer).lastCalledWith({ $batch: ['A', 'B'] }, [{}, {}], ['A', 'B'])
})
