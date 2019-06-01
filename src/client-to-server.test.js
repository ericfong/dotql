import _ from 'lodash'
import delay from 'delay'
import Client from './Client'

import Server from './Server'
import serverConf from '../test/serverConf'

test('mutate-and-eTags', async () => {
  const server = new Server(serverConf())
  let serverRes
  const _callServer = async body => {
    const ret = await server.query(_.cloneDeep(body))
    serverRes = ret
    return ret
  }
  const callServer = jest.fn(_callServer)
  const client = new Client({ callServer })
  const callServer2 = jest.fn(_callServer)
  const client2 = new Client({ callServer: callServer2 })

  client.watch({ templateById: { $args: 'demo/new' } }, () => {})
  client2.watch({ templateById: { $args: 'demo/new' } }, () => {})
  await delay(10)
  expect(serverRes[0]).toEqual({
    result: { $type: 'Queries', templateById: { id: 'demo/new', $type: 'Template' } },
    eTags: { Template: null },
  })

  await client.mutate({ setTemplateById: { $args: { id: 'demo/new', count: 1 } } })

  expect(callServer).lastCalledWith(
    [
      { spec: { $mutation: 1, setTemplateById: { $args: { count: 1, id: 'demo/new' } } } },
      { spec: { templateById: { $args: 'demo/new' } }, notMatch: { Template: null } },
    ],
    [{ cachePolicy: 'no-cache' }, { key: expect.any(String) }]
  )
  expect(serverRes).toEqual([
    {
      result: { $type: 'Mutations', setTemplateById: { id: 'demo/new', count: 1, $type: 'Template' } },
      eTags: undefined,
    },
    {
      result: { $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new', count: 1 } },
      eTags: { Template: expect.any(String) },
    },
  ])

  // client2 get new count after ping
  await client2.batchNow()
  expect(callServer2).lastCalledWith(
    [{ notMatch: { Template: null }, spec: { templateById: { $args: 'demo/new' } } }],
    [{ key: expect.any(String) }]
  )
  expect(serverRes).toMatchObject([
    {
      eTags: { Template: expect.any(String) },
      result: { $type: 'Queries', templateById: { $type: 'Template', count: 1, id: 'demo/new' } },
    },
  ])
})

test('http', async () => {
  const server = new Server(serverConf())
  const callServer = jest.fn(specs => {
    return server.query(specs)
  })
  const client = new Client({ callServer })
  const p1 = client.query({ templateById: { $args: 'demo/new' } })
  const p2 = client.query({ templateById: { $args: 'demo/new', value: 1 } })
  expect(await Promise.all([p1, p2])).toMatchObject([
    { $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new' } },
    {
      $type: 'Queries',
      templateById: { $type: 'Template', id: 'demo/new', name: 'new', projectId: 'demo', value: { defaultTemplate: true } },
    },
  ])
  expect(callServer).toBeCalledTimes(1)
})