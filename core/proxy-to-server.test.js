import { createProxy } from './Proxy'

import { createServer } from './Server'
import serverConf from '../test/serverConf'

test('http', async () => {
  const server = createServer(serverConf)
  const callServer = jest.fn(specs => {
    return server.query(specs)
  })
  const proxy = createProxy({ callServer })
  const p1 = proxy.query({ templateById: { $where: 'demo/new' } })
  const p2 = proxy.query({ templateById: { $where: 'demo/new', value: 1 } })
  expect(await Promise.all([p1, p2])).toMatchObject([
    { templateById: [{ __typename: 'Template', id: 'demo/new' }] },
    { templateById: [{ __typename: 'Template', id: 'demo/new', value: { defaultTemplate: true } }] },
  ])
  expect(callServer).toBeCalledTimes(1)
})
