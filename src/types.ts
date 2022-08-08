import http from 'http';
import { Readable } from 'stream';
import { HTTPMethod } from './';
import { Response } from './response';

export type BodyInit = string | object | Readable;
export type HeadersInit = Record<string, string>;

export interface Params {
	[name: string]: any;
}

interface AnyValue {
	[name: string]: any;
}
export interface Request<I = Params> {
	params: I;
	headers: {
		[name: string]: string | string[] | undefined;
	};
	files?: {
		[name: string]: {
			name: string;
			length: number;
			data: any;
			encoding: string;
			mimetype: string;
		};
	};
	cookies?: object;
	user?: unknown;
	host: string;
	url: string;
	method: HTTPMethod;
	path?: string;
	format?: string;
	body: http.IncomingMessage;
	rawBody?: string;
	response: http.ServerResponse;
	context: AnyValue;
}

export type MaybePromise<T> = T | Promise<T> | PromiseLike<T>;

export type Handler<I = Params, O extends BodyInit = BodyInit> = (
	request: Request<I>,
) => MaybePromise<Response<O>>;
export type Pipeline = [...Middleware[], Handler];
export type ReversedPipeline = [Handler, ...Middleware[]];

export interface Meta {
	summary?: string;
	description?: string;
	parameters?: Array<any>;
	responses?: Object;
}

export type Middleware = (handler: Handler) => (request: Request) => MaybePromise<Response>;

// export interface RoutePath {
//   [name: HTTPMethod]: any
// }

export interface RoutePaths {
	[name: string]: any;
}

export interface RouteOptions {
	middleware?: Middleware[];
	meta?: Meta;
}

interface RouteParams {
	GET?: Handler;
	POST?: Handler;
	PUT?: Handler;
	PATCH?: Handler;
	DELETE?: Handler;
	middleware?: Middleware[];
	meta?: Meta;
}

export type Route = [string, RouteParams, Route?];

export type Routes = Route[];

export interface Context {
	request: http.IncomingMessage;
	response: http.ServerResponse;
	params: Params;
	url: string;
	method: string;
	headers?: Params;
	cookies?: Object;
	format?: string;
	files?: Object;
}

export interface HandlerParams {
	handler: Handler;
	names: string[];
}

export interface HandlerParamsMap {
	[method: string]: HandlerParams;
}

export interface KeyValue {
	name: string;
	value: string;
}

export { Response };
