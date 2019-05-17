import _ from 'lodash'
import delay from 'delay'
import Proxy from './Proxy'

import Server from './Server'
import serverConf from '../test/serverConf'

test('kitchen sink', async () => {
  // DEMO START

  const server = new Server(serverConf())

  const proxy = new Proxy({
    callServer(specs) {
      return server.query(specs)
    },
  })

  // query
  const promise = proxy.query({ templateById: { $args: 'demo/new' } })
  expect(await promise).toMatchObject({ $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new' } })

  // watch
  let watchData
  const unwatch = proxy.watch({ templateById: { $args: 'demo/new' } }, (data, error) => {
    watchData = data
  })
  await delay()
  expect(watchData).toMatchObject({ $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new' } })

  // mutate
  await proxy.mutate({ setTemplateById: { $args: { id: 'demo/new', count: 1 } } })
  await delay()
  expect(watchData).toMatchObject({ $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new', count: 1 } })

  // DEMO END

  // react useOne
  // react useMutate
  // await proxy.batchNow()
})
