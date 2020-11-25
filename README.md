# Retes

Typed, Declarative, Data-Driven Routing for Node.js.

## What is Retes?

Retes is a routing library for Node.js written in TypeScript and inspired by Clojure's [Ring](https://github.com/ring-clojure/ring), [Compojure](https://github.com/weavejester/compojure) and [Retit](https://github.com/metosin/reitit). It is built directly on top of the Node.js `http` module, so you can use it as an alternative to Express or Koa.

- **Data-Driven:** In Retes you define routes using the existing data structures. This way, we limit the number of abstractions and we are able to easily transform and combine routes. Our routing description is declarative.
- **Typed:** The type system conveniently helps us control the shape of our routing
- **Battery-Included (wip):** Most common middlewares will be included out of the box

## Key Features

* built-in parsing of query params, body and route's dynamic segments
* built-in file uploading handling mechansim
* fast route matching (see [Benchmarks](#benchmarks))
* handlers are functions that take requests as input and return responses as output
* middlewares can be combined on per-route basis
* an HTTP response is just an object containing at least `statusCode` and `body` keys

## Why Retes?

* declarative route descriptions make them easily composable
* functional handlers are more natural fit for the HTTP flow
* common request/response transformations are already built-in
* typed routes make it easier to discover and control the shape of data flowing in and out

## Usage

Generate a new Node.js project

```
mkdir my-api
cd my-api
npm init -y
```

Add `retes` as a dependency

```
npm i retes
```

Create `tsconfig.json` with the following content:

```
{
  "compilerOptions": {
    "lib": [ "es2015", "DOM" ]
  }
}
```

Create `app.ts` with the following content:

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
  const app = new ServerApp(routes);
  await app.start(3000);

  console.log('started')
}

main()
```

Save it to a file, e.g. `app.ts` and run using ts-node

Install `ts-node` globally

```
npm i -g ts-node
```

Run the application

```
ts-node app.ts
```

The server application listens on the specified port, in our case `:3000`. Open [localhost:3000](http://localhost:3000) and test the routes.

## Features

### Convenience Wrappers for HTTP Responses

```ts
import { Route, ServerApp, Response } from 'retes';

const { GET, } = Route;
const { Created, OK, Accepted, InternalServerError } = Response;

const routes = [
  GET("/created", () => Created("payload")), // returns HTTP 201 Created
  GET("/ok", () => OK("payload")), // returns HTTP 200 OK
  GET("/accepted", () => Accepted("payload")), // returns HTTP 202 Accepted
  GET("/internal-error", () => InternalServerError()), // returns HTTP 500 Internal Server Error
]

async function main() {
  const app = new ServerApp(routes);
  await app.start(3000);

  console.log('started')
}

main()
```

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
  const app = new ServerApp(routes);
  await app.start(3000);

  console.log('started')
}

main()
```

### Declarative Validation

```tsx
import { Route, ServerApp, Middleware } from 'retes';
import * as z from 'zod';

const { GET } = Route;

const schema = z.object({
  name: z.string()
});

const routes = [
  GET('/request-validation', ({ params }) => {
    return `The request for this handler is validated using the given schema`,
  }, { middleware: [ Middleware.Validation(schema) ] }))
]

async function main() {
  const app = new ServerApp(routes);
  await app.start(3000);

  console.log('started')
}

main()
```

## Benchmarks

WIP


## Roadmap

- [ ] infer types for dynamic segments from routes using the string literals feature from TypeScript 4.1 (in progress PR #1)
