# Retes

Typed, Declarative, Data-Driven Routing for Node.js.

## What is Retes?

Retes is a routing library for Node.js written in TypeScript and inspired by Clojure's [Ring](https://github.com/ring-clojure/ring), [Compojure](https://github.com/weavejester/compojure) and [Retit](https://github.com/metosin/reitit). It is built directly on top of the Node.js `http` module, so you can use it as an alternative to Express or Koa.

- **Data-Driven:** In Retes you define routes using the existing data structures. This way, we limit the number of abstractions and we are able to easily transform and combine routes. Our routing description is declarative.
- **Typed:** The type system conveniently helps us control the shape of our routing
- **Battery-Included (wip):**

## Highlights

* built-in parsing of query params, body and route's dynamic segments
* built-in file uploading handling mechansim
* fast route matching (see [Benchmarks](#benchmarks))
* middlewares can be combined on per-route basis
* an HTTP response is just an object containing at least `statusCode` and `body` keys

(wip)

## Usage

```ts
import { Route, ServerApp, Response } from 'retes';

const { GET, POST } = Route;
const { Created } = Response;

const routes = [
  GET("/", () => "Hello, World"),
  GET("/welcome/:name", ({ params }) => {
    return { statusCode: 200, body: `Hello, ${params.name}` }
  }),
  POST("/user", ({ params: { name } }) => `Received: '${name}'`),
  POST("/widget", ({ params: { name, count } }) => {
    // validate `params`
    // save the widget to database ...
    return Created() // returns `201 Created` response
  })
]

async function main() {
  const app = new App(routes);
  await app.start(3000);

  console.log('started')
}

main()
```

## Features

### Middleware Composition on Per-Route Basis

```ts
import { Route, ServerApp } from 'retes';

const { GET } = Route;

const prepend = next => request => `prepend - ${next()}`;
const append = next => request => `${next()} - append`

const routes = [
  GET("/middleware", () => "Hello, Middlewares", {
    middleware: [prepend, append]
  }) // equivalent to: prepend(append(handler))
]

async function main() {
  const app = new App(routes);
  await app.start(3000);

  console.log('started')
}

main()
```

## Benchmarks


## Roadmap

- [ ] infer types for dynamic segments from routes using the string literals feature from TypeScript 4.1 (in progress #1)