import { ServerResponse } from 'http';
import { Readable } from 'stream';

import type { BodyInit, Response, HeadersInit } from './types';

interface ResponseContext {
  response: ServerResponse
}

export const handle = (context: ResponseContext) => (result: Response) => {
  if (null === result || undefined === result)
    throw new Error('No return statement in the handler');

  let { response } = context;

  let body: BodyInit, headers: HeadersInit, type, encoding;

  body = result.body;
  headers = result.headers;
  type = result.type;
  encoding = result.encoding;

  if (body instanceof Function)
    throw new Error('You need to return a value not a function.')

  // Object.assign(
  //   {
  //     'Access-Control-Allow-Origin': '*',
  //     'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  //     'Access-Control-Allow-Headers': 'Content-Type'
  //   },
  //   headers
  // );

  response.statusCode = result.status || 200;

  for (var key in headers) {
    response.setHeader(key, headers[key]);
  }

  if (encoding) response.setHeader('Content-Encoding', encoding);

  // if (Buffer.isBuffer(body)) {
  //   response.setHeader('Content-Type', type || 'application/octet-stream');
  //   response.setHeader('Content-Length', body.length);
  //   response.end(body);
  //   return;
  // }

  if (body instanceof Readable) {
    // if (!response.getHeader('Content-Type'))
    //   response.setHeader('Content-Type', type || 'text/html');
    // body.pipe(response)

    return;
  }


  if (!response.getHeader('Content-Type')) {
    response.setHeader('Content-Type', type || 'text/plain');
  }

  // if (str instanceof Buffer) {
  //   response.setHeader('Content-Length', Buffer.byteLength(str));
  // }

  let str = typeof body === 'string' ? body : JSON.stringify(body);
  response.end(str);
};
