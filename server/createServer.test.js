// import _ from 'lodash'

import createServer from './createServer'
import { serverTestConf } from './testConfig'

const server = createServer(serverTestConf)

test('Mutations', async () => {
  expect(
    await server.query({
      $mutate: 1,
      setTemplateById: {
        $args: { id: 'demo/new', count: 1 },
        value: 1,
      },
    })
  ).toMatchObject({
    setTemplateById: { __typename: 'Template', id: 'demo/new', value: { defaultTemplate: true } },
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
    templateById: [{ __typename: 'Template', id: 'demo/new', value: { defaultTemplate: true } }],
  })
})

test('$mutate', async () => {
  expect(
    await server.resolve(
      { __typename: 'Template', id: 'demo/new' },
      {
        $mutate: {
          x: 1,
        },
      },
      {}
    )
  ).toMatchObject({
    x: 1,
  })
})

test('resolve', async () => {
  expect(
    await server.resolve(
      {
        __typename: 'Template',
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
        __typename: 'Template',
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
