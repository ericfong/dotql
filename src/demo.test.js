/* eslint-disable prefer-const, no-unused-vars */
import _ from 'lodash'
import _delay from 'delay'

import { Server, Client } from '.'
import serverConf from '../test/serverConf'

const delay = (time = 10) => _delay(time)

const userDb = {}

// DEMO-03 serverConfig

const server = new Server({
  schema: {
    Queries: {
      getUserById: {
        type: 'User',
        resolve: async (dot, args, context, info) => {
          return { ...userDb[args], id: args }
        },
      },
    },
    Mutations: {
      setUserById: {
        type: 'User',
        resolve: async (dot, args, context, info) => {
          return (userDb[args.id] = Object.assign(userDb[args.id] || {}, args))
        },
      },
    },
    User: {
      id: { type: 'String' },
      count: { type: 'Int' },
      blogs: {
        type: ['Object'],
        resolve: async (dot, args, context, info) => {
          // batch.load() will auto create new DataLoader(batchLoader)
          const blogId = await context.batch.load(dot.id)
          return [{ blogId }]
        },
        batchLoader: async keys => _.map(keys, k => `< ${k} >`),
      },
    },
  },
  prepared: {
    Queries: {
      // prepared query with name='getUserById_1'
      getUserById_1: {
        // { $ref: 'where' } will be replace by prepared query references
        getUserById: { $args: { $ref: 'where' }, id: 1, count: 1 },
      },
    },
    Mutations: {
      setUserById_1: {
        // $refs will pick multiple variables
        setUserById: { $args: { $refs: { id: 'userId', count: 'count' } } },
      },
    },
  },
})

// END

test('kitchen sink', async () => {
  let result
  let watchData

  // DEMO-01 basic

  const client = new Client({
    callServer: specs => server.query(specs),
  })

  // watch
  const unwatch = client.watch({ getUserById: { $args: 'user_01', id: 1, count: 1 } }, (data, error) => {
    watchData = data
  })
  await delay()
  // watch will fill initial data
  expect(watchData).toMatchObject({ getUserById: { $type: 'User', id: 'user_01', count: undefined } })

  // mutate
  await client.mutate({ setUserById: { $args: { id: 'user_01', count: 10 } } })
  await delay()
  expect(watchData).toMatchObject({ getUserById: { $type: 'User', id: 'user_01', count: 10 } })

  // END

  // DEMO-02 prepared query

  // use prepared query 'getUserById_1'
  expect(await client.query({ $query: 'getUserById_1', where: 'user_01' })).toMatchObject({
    getUserById: { $type: 'User', id: 'user_01' },
  })

  // use prepared mutation 'setUserById_1'
  await client.mutate({ $mutation: 'setUserById_1', userId: 'user_01', count: 20 })
  await delay()
  expect(watchData).toMatchObject({ getUserById: { $type: 'User', id: 'user_01', count: 20 } })

  // END

  // DEMO-04 batchLoader

  // resolve via batchLoader
  result = await client.query({ getUserById: { $args: 'user_01', blogs: 1 } })
  expect(result).toMatchObject({ getUserById: { $type: 'User', blogs: [{ blogId: '< user_01 >' }] } })

  // END

  // react useOne
  // react useMutate
  // await client.batchNow()
})
