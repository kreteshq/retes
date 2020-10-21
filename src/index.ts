// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import Debug from 'debug';
const debug = Debug('retes:index'); // eslint-disable-line no-unused-vars

import http from 'http';
import { AddressInfo } from 'net';
import { Router } from './router';

import { Handler, RouteOptions, Route, Response, ResponseBody, Resource, Routes, Context, RoutePaths, Middleware, Request, LocalMiddleware } from './types';
import { handle } from './core';
import { Routing } from './routing';
import { compose } from './util';

export const HTTPMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATH: 'PATCH',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  DELETE: 'DELETE',
} as const;
export type HTTPMethod = (typeof HTTPMethod)[keyof typeof HTTPMethod];

const Route = {
  GET(path: string, handler: Handler, { middleware = [], meta = {}}: RouteOptions = {}): Route {
    return [path, { GET: handler, middleware, meta }]
  },
  POST(path: string, handler: Handler, { middleware = [], meta = {}}: RouteOptions = {}): Route {
    return [path, { POST: handler, middleware, meta }]
  },
  PATCH(path: string, handler: Handler, { middleware = [], meta = {}}: RouteOptions = {}): Route {
    return [path, { PATCH: handler, middleware, meta }]
  },
  PUT(path: string, handler: Handler, { middleware = [], meta = {}}: RouteOptions = {}): Route {
    return [path, { PUT: handler, middleware, meta }]
  },
  DELETE(path: string, handler: Handler, { middleware = [], meta = {}}: RouteOptions = {}): Route {
    return [path, { DELETE: handler, middleware, meta }]
  },
};

const Response = {
  OK(body: ResponseBody, headers = {}) {
    return { headers, body, statusCode: 200 } as Response;
  },

  Created(resource: Resource = '', headers = {}) {
    return {
      statusCode: 201,
      headers,
      body: resource,
    };
  },

  HTMLString(content: string) {
    return {
      statusCode: 200,
      type: 'text/html',
      body: content,
    };
  },

  NotFound(headers = {}): Response {
    return {
      statusCode: 404,
      type: 'text/html',
      headers,
      body: "Not Found"
    };
  }
}

class Base extends Array {
  async next(context: Context, last, current: number, done?: boolean, called?: boolean, func?) {
    if ((done = current > this.length)) return;

    func = this[current] || last;

    return (
      func &&
      func(context, async () => {
        if (called) throw new Error('next() already called');
        called = true;
        return this.next(context, last, current + 1);
      })
    );
  }

  async compose(context: Context, last?) {
    return this.next(context, last, 0);
  }
}

export class App {
  server: http.Server | undefined;
  router: Router;
  middlewares: Base;
  routes: Routes;

  constructor(routes: Routes) {
    this.middlewares = new Base();
    this.router = new Router();
    this.routes = routes;
  }

  use(middleware: Middleware | Promise<Middleware>) {
    this.middlewares.push(middleware);
    return this;
  }

  add(method: HTTPMethod, path: string, ...fns: (LocalMiddleware | Handler)[]) {
    const action = fns.pop();

    // pipeline is a handler composed over middlewares,
    // `action` function must be explicitly extracted from the pipeline
    // as it has different signature, thus cannot be composed
    const pipeline = fns.length === 0 ? action : compose(...fns)(action);

    this.router.add(method.toUpperCase(), path, pipeline);

    return this;
  }

  async start(port: number = 0) {
    const routePaths: RoutePaths = {};

    for (const [path, params] of this.routes) {
      const { middleware = [], meta = {} } = params;
      const { summary = path } = meta;

      for (let [method, handler] of Object.entries(params)) {
        if (method in HTTPMethod) {
          routePaths[path] = {}
          routePaths[path][method.toLowerCase()] = {
            ...meta,
            summary,
          };

          const flow = middleware.concat(handler);
          this.add(method as HTTPMethod, path, ...flow);
        }
        // else: a key name undefined in the spec -> discarding
      }
    }

    this.use(Routing(this.router));

    // append 404 middleware handler: it must be put at the end and only once
    // TODO Move to `catch` for pattern matching ?
    this.use(() => Response.NotFound());

    this.server = http
      .createServer((request, response) => {
        const context = { params: {}, headers: {}, request, response } as Context;

        this.middlewares
          .compose(context)
          .then(handle(context))
          .catch(error => {
            response.statusCode = 500;
          });
      })
      .on('error', error => {
        console.error(error.message);
        process.exit(1);
      });

    return new Promise<http.Server>((resolve, reject) => {
      this.server?.listen(port, () => {
        resolve(this.server);
      });
    })
  }

  async stop() {
    return new Promise((resolve, reject) => {
      this.server?.close((err) => {
        if (err) return reject(err);
        resolve();
      })
    })
  }

  get port () {
    const { port } = this.server?.address() as AddressInfo;
    return port;
  }
}

export {
  Route,
  Routes,
  Response
}

