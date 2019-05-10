import _ from 'lodash'
import delay from 'delay'
import { createProxy } from './Proxy'

import { createServer } from './Server'
import serverConf from '../test/serverConf'

test('mutate-and-eTags', async () => {
  const server = createServer(serverConf())
  let serverRes
  const _callServer = async body => {
    const ret = await server.query(_.cloneDeep(body))
    serverRes = ret
    return ret
  }
  const callServer = jest.fn(_callServer)
  const proxy = createProxy({ callServer })
  const callServer2 = jest.fn(_callServer)
  const proxy2 = createProxy({ callServer: callServer2 })

  proxy.watch({ templateById: { $args: 'demo/new' } }, () => {})
  proxy2.watch({ templateById: { $args: 'demo/new' } }, () => {})
  await delay(10)
  expect(serverRes.$batch[0]).toEqual({
    result: { $type: 'Queries', templateById: { id: 'demo/new', $type: 'Template' } },
    eTags: { Template: undefined },
  })

  await proxy.mutate({ setTemplateById: { $args: { id: 'demo/new', count: 1 } } })

  expect(callServer).lastCalledWith({
    $batch: [
      { spec: { $type: 'Mutations', setTemplateById: { $args: { count: 1, id: 'demo/new' } } } },
      { spec: { templateById: { $args: 'demo/new' } }, notMatch: { Template: undefined } },
    ],
  })
  expect(serverRes.$batch).toEqual([
    {
      result: { $type: 'Mutations', setTemplateById: { id: 'demo/new', count: 1, $type: 'Template' } },
      eTags: undefined,
    },
    {
      result: { $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new', count: 1 } },
      eTags: { Template: expect.any(String) },
    },
  ])

  // proxy2 get new count after ping
  await proxy2.batchNow()
  expect(callServer2).lastCalledWith({
    $batch: [{ notMatch: { Template: undefined }, spec: { templateById: { $args: 'demo/new' } } }],
  })
  expect(serverRes.$batch).toMatchObject([
    {
      eTags: { Template: expect.any(String) },
      result: { $type: 'Queries', templateById: { $type: 'Template', count: 1, id: 'demo/new' } },
    },
  ])
})

test('http', async () => {
  const server = createServer(serverConf())
  const callServer = jest.fn(specs => {
    return server.query(specs)
  })
  const proxy = createProxy({ callServer })
  const p1 = proxy.query({ templateById: { $args: 'demo/new' } })
  const p2 = proxy.query({ templateById: { $args: 'demo/new', value: 1 } })
  expect(await Promise.all([p1, p2])).toMatchObject([
    { $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new' } },
    {
      $type: 'Queries',
      templateById: { $type: 'Template', id: 'demo/new', name: 'new', projectId: 'demo', value: { defaultTemplate: true } },
    },
  ])
  expect(callServer).toBeCalledTimes(1)
})
