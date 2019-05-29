/* eslint-disable no-unused-vars */
import _ from 'lodash'
import delay from 'delay'
import Proxy from './Proxy'

import Server from './Server'
import serverConf from '../test/serverConf'

const userDb = {}

// DEMO 3 START

const serverConfig = {
  schema: {
    Queries: {
      userById: {
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
      role: {
        type: 'Object',
        resolve: async (dot, args, context, info) => 'Admin_Role',
      },
    },
  },
  prepared: {
    Queries: {
      // prepared query with name='userById_1'
      userById_1: {
        // { $ref: 'where' } will be replace by prepared query references
        userById: { $args: { $ref: 'where' } },
      },
    },
    Mutations: {
      setUserById_1: {
        setUserById: { $args: { $refs: ['id', 'count'] } },
      },
    },
  },
}

// DEMO 3 END

test('kitchen sink', async () => {
  // DEMO 1 START

  const server = new Server(serverConfig)

  const proxy = new Proxy({
    callServer(specs) {
      return server.query(specs)
    },
  })

  // query
  const promise = proxy.query({ userById: { $args: 'user_01' } })
  expect(await promise).toMatchObject({ userById: { $type: 'User', id: 'user_01' } })

  // watch
  let watchData
  const unwatch = proxy.watch({ userById: { $args: 'user_01' } }, (data, error) => {
    watchData = data
  })
  await delay()
  expect(watchData).toMatchObject({ userById: { $type: 'User', id: 'user_01' } })

  // mutate
  await proxy.mutate({ setUserById: { $args: { id: 'user_01', count: 1 } } })
  await delay()
  expect(watchData).toMatchObject({ userById: { $type: 'User', id: 'user_01', count: 1 } })

  // DEMO 1 END

  // DEMO 2 START

  // use prepared query 'userById_1'
  expect(await proxy.query({ $query: 'userById_1', where: 'user_01' })).toMatchObject({
    userById: { $type: 'User', id: 'user_01' },
  })

  // use prepared mutation 'setUserById_1'
  await proxy.mutate({ $mutation: 'setUserById_1', id: 'user_01', count: 2 })
  await delay()
  expect(watchData).toMatchObject({ userById: { $type: 'User', id: 'user_01', count: 2 } })

  // DEMO 2 END

  // react useOne
  // react useMutate
  // await proxy.batchNow()
})
