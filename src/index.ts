// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import Debug from 'debug';
const debug = Debug('retes:index'); // eslint-disable-line no-unused-vars

import http from 'http';
import { AddressInfo } from 'net';
import { Router } from './router';

import { Handler, RouteOptions, Route, Response, CompoundResponse, ResponseBody, Resource, Routes, Context, RoutePaths, Middleware, Request, LocalMiddleware } from './types';
import { handle } from './core';
import { Routing } from './routing';
import { compose } from './util';
import { getServerStopFunc } from './graceful-stop';

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
  }
};

const Response = {
  OK(body: ResponseBody, headers = {}): Response {
    return { headers, body, statusCode: 200 };
  },

  Created(resource: Resource = '', headers = {}): Response {
    return {
      statusCode: 201,
      headers,
      body: resource,
    };
  },

  Accepted(resource: Resource = '', headers = {}): Response {
    return {
      statusCode: 202,
      headers,
      body: resource
    };
  },

  NoContent(headers = {}): Response {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  },

  Redirect(url: string, body = 'Redirecting...', statusCode = 302): Response {
    return {
      statusCode,
      headers: { Location: url },
      type: 'text/plain',
      body,
    };
  },

  NotModified(headers = {}): Response {
    return {
      statusCode: 304,
      headers,
      body: '',
    };
  },

  JSONPayload(content, statusCode = 200) {
    return {
      statusCode,
      body: JSON.stringify(content),
      type: 'application/json',
    };
  },

  HTMLString(content: string): Response {
    return {
      statusCode: 200,
      type: 'text/html',
      body: content,
    };
  },

  HTMLStream(content): Response {
    const Readable = require('stream').Readable;

    const s = new Readable();
    s.push(content);
    s.push(null);

    return s;
  },

  JavaScriptString(content: string): Response {
    return {
      statusCode: 200,
      type: 'application/javascript',
      body: content,
    };
  },

  StyleSheetString(content: string): Response {
    return {
      statusCode: 200,
      type: 'text/css',
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
  },

  Unauthorized(): Response {
    return {
      statusCode: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm=Authorization Required'
      },
      body: ''
    };
  },

  Forbidden(content: string = ''): Response {
    return {
      statusCode: 403,
      body: content
    };
  },

  InternalServerError(content: string = ''): Response {
    return {
      statusCode: 500,
      body: content
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

export class ServerApp {
  server: http.Server | undefined;
  router: Router;
  middlewares: Base;
  routes: Routes;
  routePaths: Object;
  stop: () => Promise<void>;

  constructor(routes: Routes) {
    this.middlewares = new Base();
    this.router = new Router();
    this.routes = routes;
    this.routePaths = {};
    this.stop = () => Promise.reject(`You should start the server first`);

    // TODO move it to `start` once it's abstracted
    for (const [path, params] of this.routes) {
      const { middleware = [], meta = {} } = params;
      const { summary = path } = meta;

      for (let [method, handler] of Object.entries(params)) {
        if (method in HTTPMethod) {
          this.routePaths[path] = {}
          this.routePaths[path][method.toLowerCase()] = {
            ...meta,
            summary,
          };

          const flow = middleware.concat(handler);
          this.add(method as HTTPMethod, path, ...flow);
        }
        // else: a key name undefined in the spec -> discarding
      }
    }
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
        this.stop = getServerStopFunc(this.server);
        resolve(this.server);
      });
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
  Response,
  CompoundResponse,
  Resource,
  ResponseBody,
  Request,
  Handler,
  handle,
}

