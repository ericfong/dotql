// import _ from 'lodash'

import Server from './Server'
import serverConf from '../test/serverConf'

const server = new Server(serverConf())

test('queryNormalizeSpec', async () => {
  expect(server.queryNormalizeSpec({ $type: 'Queries', $extend: 'templateById', where: 'demo/new' })).toMatchObject({
    $type: 'Queries',
    templateById: { $args: 'demo/new' },
  })

  expect(await server.query({ $extend: 'templateById', where: 'demo/new' })).toMatchObject({
    $type: 'Queries',
    templateById: { $type: 'Template', id: 'demo/new' },
  })

  expect(
    await server.query({ $type: 'Mutations', $extend: 'setTemplateById', args: { count: 1, id: 'demo/new' } })
  ).toMatchObject({ setTemplateById: { $type: 'Template', id: 'demo/new' } })
})

test('Mutations', async () => {
  expect(
    await server.query({
      $type: 'Mutations',
      setTemplateById: {
        $args: { id: 'demo/new', count: 1 },
        value: 1,
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
      },
    })
  ).toMatchObject({
    templateById: { $type: 'Template', id: 'demo/new', value: { defaultTemplate: true } },
  })
})

test('resolve', async () => {
  expect(
    await server.resolve(
      {
        $type: 'Template',
        id: 'demo/new',
      },
      {
        value: 1,
      },
      {}
    )
  ).toMatchObject({
    value: { defaultTemplate: true },
  })
  expect(
    await server.resolve(
      {
        $type: 'Template',
        id: 'demo/new2',
        json: '{"x":1}',
      },
      {
        value: 1,
      },
      {}
    )
  ).toMatchObject({ value: { x: 1 } })
})
