# dotql

graphql like but query by plain json. No more DSL or AST parsing

---

![https://img.shields.io/npm/v/dotql.svg](https://img.shields.io/npm/v/dotql.svg?style=flat-square)
![npm](https://img.shields.io/npm/dt/dotql.svg?maxAge=2592000&style=flat-square)
![npm](https://img.shields.io/npm/l/dotql.svg?style=flat-square)
![npm](https://img.shields.io/github/languages/code-size/ericfong/dotql.svg?style=flat-square)

A graphql like client and server without graphql DSL, faster parsing.

Built-in implementation for live-query (by ping or/and push)

### List of features

- strictly follow graphql but in json, no more DSL parsing
- small in size, all-in-one instead of few heavy weighted packages
- built-in implementation for live-query (by ping or/and push)

### Basic Usage

dotql query

```js
client.query({
  getUserById: {
    // with id:'user_01' arguments
    $args: { id: 'user_01' },
    // ask for name and photo fields
    name: 1,
    photo: 1,
  },
})
```

instead of graphql query

```js
graphqlClient.query(gql`
  {
    getUserById(id: "user_01") {
      name
      photo
    }
  }
`)
```

mutate and watch server data via client

```js
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
```

use prepared queries for smaller request payload and hiding schema detail

```js
// use prepared query 'getUserById_1'
expect(await client.query({ $query: 'getUserById_1', where: 'user_01' })).toMatchObject({
  getUserById: { $type: 'User', id: 'user_01' },
})

// use prepared mutation 'setUserById_1'
await client.mutate({ $mutation: 'setUserById_1', userId: 'user_01', count: 20 })
await delay()
expect(watchData).toMatchObject({ getUserById: { $type: 'User', id: 'user_01', count: 20 } })
```

create server instance

```js
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
```

trigger resolve to call context.batch.load() which use built-in support of [dataloader](https://www.npmjs.com/package/dataloader)

```js
// resolve via batchLoader
result = await client.query({ getUserById: { $args: 'user_01', blogs: 1 } })
expect(result).toMatchObject({ getUserById: { $type: 'User', blogs: [{ blogId: '< user_01 >' }] } })
```

### Size

dotql client and server

![npm](https://img.shields.io/github/languages/code-size/ericfong/dotql.svg?style=flat-square)

graphql (not yet include apollo or relay)

![npm](https://img.shields.io/github/languages/code-size/graphql/graphql-js.svg?style=flat-square)

### Contributing

Keep it simple. Keep it minimal. Don't put every single feature just because you can.
