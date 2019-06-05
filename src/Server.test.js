// import _ from 'lodash'

import Server from './Server'
import serverConf from '../test/serverConf'

const server = new Server(serverConf())

test('preresolve', async () => {
  const server2 = new Server(
    serverConf({
      preresolve: () => {
        return {}
      },
    })
  )
  expect(
    await server2.query({
      templateById: {
        $args: 'demo/new',
        value: 1,
      },
    })
  ).toMatchObject({
    templateById: { $type: 'Template', value: { defaultTemplate: true } },
  })
  expect(
    await server2.query({
      templateById: {
        $args: 'demo/new',
        id: 1,
        name: 1,
      },
    })
  ).toMatchObject({ templateById: { $type: 'Template', id: 'demo/new', name: 'new' } })
})

test('queryNormalizeSpec', async () => {
  expect(server.queryNormalizeSpec({ $query: 'templateById', where: 'demo/new' })).toMatchObject({
    $query: 'templateById',
    templateById: { $args: 'demo/new' },
  })

  expect(await server.query({ $query: 'templateById', where: 'demo/new' })).toMatchObject({
    $type: 'Queries',
    templateById: { $type: 'Template', id: 'demo/new' },
  })

  expect(
    await server.query({ $type: 'Mutations', $mutation: 'setTemplateById', args: { count: 1, id: 'demo/new' } })
  ).toMatchObject({
    setTemplateById: { $type: 'Template', id: 'demo/new' },
  })
})

test('Mutations', async () => {
  expect(
    await server.query({
      $mutation: 1,
      setTemplateById: {
        $args: { id: 'demo/new', count: 1 },
        value: 1,
        id: 1,
        count: 1,
      },
    })
  ).toMatchObject({ $type: 'Mutations', setTemplateById: { $type: 'Template', count: 1, id: 'demo/new' } })
})

test('Queries', async () => {
  expect(
    await server.query({
      templateById: {
        $args: 'demo/new',
        value: 1,
        id: 1,
      },
    })
  ).toMatchObject({
    templateById: { $type: 'Template', id: 'demo/new', value: { defaultTemplate: true } },
  })
})
