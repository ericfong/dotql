# dotql

graphql like but query by plain json. No more DSL or AST parsing

---

![https://img.shields.io/npm/v/dotql.svg](https://img.shields.io/npm/v/dotql.svg?style=flat-square)
![npm](https://img.shields.io/npm/dt/dotql.svg?maxAge=2592000&style=flat-square)
![npm](https://img.shields.io/npm/l/dotql.svg?style=flat-square)
![npm](https://img.shields.io/github/languages/code-size/ericfong/dotql.svg?style=flat-square)

A graphql like client and server without graphql DSL, faster parsing, and easy to customize interface.

Built-in implementation for live-query (by ping or/and push)

### List of features

- strictly follow graphql but in json, no more DSL parsing
- small in size, all-in-one instead of few heavy weighted packages
- built-in implementation for live-query (by ping or/and push)
- customizable interface

### Code Demo

```js
dotqlProxy.query({
  userById: {
    name: 1,
    photo: 1,
  },
})
```

instead of

```js
graphqlClient.query(gql`
  {
    userById {
      name
      photo
    }
  }
`)
```

### Download & Installation

```shell
npm i dotql
```

### Size

dotql client and server

![npm](https://img.shields.io/github/languages/code-size/ericfong/dotql.svg?style=flat-square)

graphql (not counting client like apollo)

![npm](https://img.shields.io/github/languages/code-size/graphql/graphql-js.svg?style=flat-square)

### Contributing

Keep it simple. Keep it minimal. Don't put every single feature just because you can.
