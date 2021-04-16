import { ReadStream } from 'fs'
import http from 'http';

export interface Params {
  [name: string]: any
}

export type Next = (request?: Request) => Response | Promise<Response>;

export interface Request<U = unknown> {
  params: Params
  headers?: {
    [name: string]: any
  }
  files?: {
    [name: string]: {
      name: string
      length: number
      data: any
      encoding: string
      mimetype: string
    }
  }
  cookies?: object
  user?: U 
  url: string
  path: string
  method: string
  format: string
  body: http.IncomingMessage
  response: http.ServerResponse
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

export type Handler = (request: Request) => Response | Promise<Response>;
export type Pipeline = [...Middleware[], Handler];

export interface Meta {
  summary?: string
  description?: string
  parameters?: Array<any>
  responses?: Object
}

export type Middleware = (handler: Handler) => (request: Request) => Response | Promise<Response>

// export interface RoutePath {
//   [name: HTTPMethod]: any
// }

export interface RoutePaths {
  [name: string]: any
}

export interface RouteOptions {
  middleware?: Middleware[]
  meta?: Meta
}

interface RouteParams {
  GET?: Handler
  POST?: Handler
  PUT?: Handler
  PATCH?: Handler
  DELETE?: Handler
  middleware?: Middleware[]
  meta?: Meta
}

export type Route = [string, RouteParams, Route?];

export type Routes = Route[]

export interface Context {
  request: http.IncomingMessage
  response: http.ServerResponse
  params: Params
  url: string
  method: string
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
