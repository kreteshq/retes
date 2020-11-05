import { ReadStream } from 'fs'
import http from 'http';

export interface Params {
  [name: string]: any
}

export type InferRouteParams<T extends string> =
  string extends T ? Record<string, string> :
  T extends `${infer _}:${infer Param}/${infer Rest}` ? {[k in Param | keyof InferRouteParams<Rest>]: string} :
  T extends `${infer _}:${infer Param}` ? {[k in Param]: string} :
  Params;

export type Next = (request?: Request) => Response | Promise<Response>;

export interface Request<RoutePath extends string = ""> {
  params: InferRouteParams<RoutePath>
  headers?: {
    [name: string]: any
  },
  files?: {
    [name: string]: {
      name: string
      length: number
      data: any
      encoding: string
      mimetype: string
    }
  },
  url: string,
  method: string
  format: string
}

export type ResponseBody = string | object;
export type Resource = ResponseBody | undefined;

export interface CompoundResponse {
  body: ResponseBody
  statusCode: number
  headers?: object
  type?: string
}

export type Response =
  | string
  | CompoundResponse
  | Buffer
  | ReadStream;

export type Handler<RoutePath extends string = ""> = (request: Request<RoutePath>) => Response | Promise<Response>;

export interface Meta {
  summary?: string
  description?: string
  parameters?: Array<any>
  responses?: Object
}

export type GlobalMiddleware = (context: Context, next: Next) => Response | Promise<Response>
export type LocalMiddleware = (next: Next) => (request: Request) => Response | Promise<Response>

export type Middleware = GlobalMiddleware | LocalMiddleware;

// export interface RoutePath {
//   [name: HTTPMethod]: any
// }

export interface RoutePaths {
  [name: string]: any
}

export interface RouteOptions {
  middleware?: LocalMiddleware[]
  meta?: Meta
}

interface RouteParams<R extends string> {
  GET?: Handler<R>
  POST?: Handler
  PUT?: Handler
  PATCH?: Handler
  DELETE?: Handler
  middleware?: LocalMiddleware[]
  meta?: Meta
}

export type Route<R extends string = ""> = [string, RouteParams<R>, Route<R>?];

export type Routes<R extends string = ""> = Route<R>[]

export interface Context {
  request: http.IncomingMessage
  response: http.ServerResponse
  params: Params
  headers?: Params
  cookies?: Object
  format?: string
  files?: Object
}

export interface HandlerParams {
  handler: Handler
  names: string[]
}

export interface HandlerParamsMap {
  [method: string]: HandlerParams
}

export interface KeyValue {
  name: string
  value: string
}
