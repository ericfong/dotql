// import _ from 'lodash'

import { createServer } from './Server'
import serverConf from '../test/serverConf'

const server = createServer(serverConf)

test('Mutations', async () => {
  expect(
    await server.query({
      $type: 'Mutations',
      setTemplateById: {
        $args: { id: 'demo/new', count: 1 },
        value: 1,
      },
    })
  ).toMatchObject({
    setTemplateById: { $type: 'Template', id: 'demo/new', value: { defaultTemplate: true } },
  })
})

test('Queries', async () => {
  expect(
    await server.query({
      templateById: {
        $where: 'demo/new',
        value: 1,
      },
    })
  ).toMatchObject({
    templateById: [{ $type: 'Template', id: 'demo/new', value: { defaultTemplate: true } }],
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
