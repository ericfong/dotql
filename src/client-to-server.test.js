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

  client.watch({ templateById: { $args: 'demo/new', id: true, count: true } }, () => {})
  client2.watch({ templateById: { $args: 'demo/new', id: true, count: true } }, () => {})
  await delay(10)
  expect(serverRes[0]).toEqual({
    data: { $type: 'Queries', templateById: { id: 'demo/new', $type: 'Template' } },
    eTags: { Template: null },
  })

  await client.mutate({ setTemplateById: { $args: { id: 'demo/new', count: 1 }, count: true, id: true } })

  expect(callServer).lastCalledWith(
    [
      { spec: { $mutation: 1, setTemplateById: { $args: { count: 1, id: 'demo/new' }, count: true, id: true } } },
      { spec: { templateById: { $args: 'demo/new', id: true, count: true } }, notMatch: { Template: null } },
    ],
    [{ cachePolicy: 'no-cache' }, { key: expect.any(String) }]
  )
  expect(serverRes).toEqual([
    {
      data: { $type: 'Mutations', setTemplateById: { id: 'demo/new', count: 1, $type: 'Template' } },
      eTags: undefined,
    },
    {
      data: { $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new', count: 1 } },
      eTags: { Template: expect.any(String) },
    },
  ])

  // client2 get new count after ping
  await client2.batchNow()
  expect(callServer2).lastCalledWith(
    [{ notMatch: { Template: null }, spec: { templateById: { $args: 'demo/new', id: true, count: true } } }],
    [{ key: expect.any(String) }]
  )
  expect(serverRes).toMatchObject([
    {
      eTags: { Template: expect.any(String) },
      data: { $type: 'Queries', templateById: { $type: 'Template', count: 1, id: 'demo/new' } },
    },
  ])
})

test('http', async () => {
  const server = new Server(serverConf())
  const callServer = jest.fn(specs => {
    return server.query(specs)
  })
  const client = new Client({ callServer })
  const p1 = client.query({ templateById: { $args: 'demo/new', id: 1 } })
  const p2 = client.query({ templateById: { $args: 'demo/new', value: 1, id: 1, name: 1, projectId: 1 } })
  expect(await Promise.all([p1, p2])).toMatchObject([
    { $type: 'Queries', templateById: { $type: 'Template', id: 'demo/new' } },
    {
      $type: 'Queries',
      templateById: { $type: 'Template', id: 'demo/new', name: 'new', projectId: 'demo', value: { defaultTemplate: true } },
    },
  ])
  expect(callServer).toBeCalledTimes(1)
})
