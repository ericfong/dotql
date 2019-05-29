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

```js
dotqlProxy.query({
  myUser: {
    name: 1,
    photo: 1,
  },
})
```

instead of

```js
graphqlClient.query(gql`
  {
    myUser {
      name
      photo
    }
  }
`)
```

### Demo

- create server and proxy
- query, mutate and watch server data via proxy

```js
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
```

use prepared queries for smaller request payload and hiding schema detail

```js
// use prepared query 'userById_1'
expect(await proxy.query({ $query: 'userById_1', where: 'user_01' })).toMatchObject({
  userById: { $type: 'User', id: 'user_01' },
})

// use prepared mutation 'setUserById_1'
await proxy.mutate({ $mutation: 'setUserById_1', id: 'user_01', count: 2 })
await delay()
expect(watchData).toMatchObject({ userById: { $type: 'User', id: 'user_01', count: 2 } })
```

### Size

dotql client and server

![npm](https://img.shields.io/github/languages/code-size/ericfong/dotql.svg?style=flat-square)

graphql (not yet include apollo or relay)

![npm](https://img.shields.io/github/languages/code-size/graphql/graphql-js.svg?style=flat-square)

### Contributing

Keep it simple. Keep it minimal. Don't put every single feature just because you can.
