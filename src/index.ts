// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import http from 'http';
import { Logger } from 'tslog';
import { handle } from './core';
import { Response } from './response';
import { Router } from './router';
import { Routing } from './routing';
import { createHTTPTerminator } from './terminator';

import type { AddressInfo } from 'net';
import type { Handler, Middleware, Pipeline, Request, Routes } from './types';

export const HTTPMethod = {
	GET: 'GET',
	POST: 'POST',
	PUT: 'PUT',
	PATH: 'PATCH',
	HEAD: 'HEAD',
	OPTIONS: 'OPTIONS',
	DELETE: 'DELETE',
} as const;
export type HTTPMethod = typeof HTTPMethod[keyof typeof HTTPMethod];

const compose = <T extends CallableFunction, U>(...functions: T[]) => (args: U) =>
	functions.reduceRight((arg, fn) => fn(arg), args);

const logger = new Logger({
	prettyLogTemplate: '{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
});

export class ServerApp {
	server: http.Server | undefined;
	router: Router;
	middlewares: Array<Middleware>;
	routes: Routes;
	routePaths: Object;
	gracefulTerminationTimeout?: number;
	stop: () => Promise<void>;
	handleError: (request: Request) => (error: Error) => void;
	append: (request: Request) => () => void;
	custom: (
		request: http.IncomingMessage,
		response: http.ServerResponse,
		next: Function,
	) => void;

	constructor(
		routes: Routes,
		middlewares: Middleware[] = [],
		handleError = ({ response }) => (error) => {
			response.writeHead(500).end(error.message);
		},
		append = (context) => () => {},
		custom = (request, response, next) => {
			next();
		},
		gracefulTerminationTimeout: number = 500,
	) {
		this.middlewares = middlewares;
		this.router = new Router();
		this.routes = routes;
		this.routePaths = {};
		this.stop = () => Promise.reject(`You need to start the server first`);
		this.handleError = handleError;
		this.append = append;
		this.custom = custom;
		this.gracefulTerminationTimeout = gracefulTerminationTimeout;

		// TODO move it to `start` once it's abstracted
		for (const [path, params] of this.routes) {
			const { middleware = [], meta = {} } = params;
			const { summary = path } = meta;

			for (let [method, handler] of Object.entries(params)) {
				if (method in HTTPMethod) {
					this.routePaths[path] = {};
					this.routePaths[path][method.toLowerCase()] = {
						...meta,
						summary,
					};

					const flow: Pipeline = [...middleware, handler as Handler];
					this.add(method as HTTPMethod, path, ...flow);
				}
				// else: a key name undefined in the spec -> discarding
			}
		}
	}

	use(middleware: Middleware) {
		this.middlewares.push(middleware);
		return this;
	}

	add(method: HTTPMethod, path: string, ...fns: [...Middleware[], Handler]) {
		const action = fns.pop();

		// pipeline is a handler composed over middlewares,
		// `action` function must be explicitly extracted from the pipeline
		// as it has different signature, thus cannot be composed
		const pipeline = fns.length === 0 ? action : compose(...(fns as Middleware[]))(action);

		this.router.add(method.toUpperCase(), path, pipeline);

		return this;
	}

	async setup() {
		this.use(Routing(this.router));
	}

	async start(port: number = 0) {
		await this.setup();

		this.server = http
			.createServer((request, response) => {
				const { method, url, headers } = request;
				const context = {
					params: {},
					context: {},
					headers,
					method,
					url,
					body: request,
					response,
				} as Request;

				const pipeline = compose<Middleware, Handler>(...this.middlewares)(
					(_) => Response.NotFound(),
				);

				const prepend = (next) => this.custom(request, response, next);
				pipeline(context)
					.then(handle(context))
					.then(this.append(context))
					.catch(this.handleError(context));
			})
			.on('error', (error) => {
				console.error(error.message);
				process.exit(1);
			});

		const terminator = createHTTPTerminator({
			server: this.server,
			terminationTimeout: this.gracefulTerminationTimeout,
		});

		this.stop = () => terminator.terminate();

		return new Promise<http.Server>((resolve, reject) => {
			this.server?.listen(port, () => {
				console.log();
				logger.info(`Server running on http://127.0.0.1:${port} (Press CTRL+C to quit)`);
				resolve(this.server);
			});
		});
	}

	get port() {
		const { port } = this.server?.address() as AddressInfo;
		return port;
	}
}

export type { Handler, Middleware, Pipeline, Request, Routes };

export { handle };

export * as response from './response';
export { Routing } from './routing';
