import type { NextApiHandler, NextApiRequest } from 'next';
import type { Handler, Pipeline, Request } from "./types";
import type { HTTPMethod } from "./";

import { IncomingMessage } from 'node:http';
import querystring from 'querystring';
import { ApiError } from 'next/dist/server/api-utils';
import { parse } from "next/dist/compiled/content-type";
import isError from "next/dist/lib/is-error";

import { isObject, composePipeline, isPipeline } from "./util";

function parseJson(str: string): object {
  if (str.length === 0) {
    return {}
  }

  try {
    return JSON.parse(str)
  } catch (e) {
    throw new ApiError(400, 'Invalid JSON')
  }
}

export async function parseBody(
  req: IncomingMessage,
  limit: string | number
): Promise<any> {
  let contentType
  try {
    contentType = parse(req.headers['content-type'] || 'text/plain')
  } catch {
    contentType = parse('text/plain')
  }
  const { type, parameters } = contentType
  const encoding = parameters.charset || 'utf-8'

  let buffer

  try {
    const getRawBody =
      require('next/dist/compiled/raw-body') as typeof import('next/dist/compiled/raw-body')
    buffer = await getRawBody(req, { encoding, limit })
  } catch (e) {
    if (isError(e) && e.type === 'entity.too.large') {
      throw new ApiError(413, `Body exceeded ${limit} limit`)
    } else {
      throw new ApiError(400, 'Invalid body')
    }
  }

  const rawBody = buffer.toString()

  if (type === 'application/json' || type === 'application/ld+json') {
    return {
      rawBody,
      body: parseJson(rawBody)
    }
  } else if (type === 'application/x-www-form-urlencoded') {
    const qs = require('querystring')
    return {
      rawBody,
      body: qs.decode(rawBody)
    }
  } else {
    return {
      rawBody,
      body: rawBody
    }
  }
}

const fromNextRequest = async (req: NextApiRequest): Promise<Request> => {
  const { method, url, headers = {} } = req;
  const { host } = headers;

  let bodies;

  if (!req.body) {
    bodies = await parseBody(req, "1mb")
  }

  const body = req.body || bodies.body;
  const params = Object.assign({}, body || {}); // to fix the `[Object: null prototype]` warning

  console.log('asdf')

  const request: Request = {
    params,
    context: {},
    headers,
    host,
    method: method as HTTPMethod,
    url,
    body: req.body || body,
    rawBody: bodies?.rawBody,
    // FIXME
    response: null
  };

  return request;
}

export const toNextHandler = (flow: Handler | Pipeline): NextApiHandler => {
  // FIXME handle empty array
  // FIXME handle one element array

  const handler = isPipeline(flow) && flow.length > 1 ? composePipeline(flow) : flow as Handler;

  return async (req, res) => {
    const response = await handler(await fromNextRequest(req));
    const { body, status, headers } = response;

    for (var key in headers) {
      res.setHeader(key, headers[key]);
    }

    res.status(status).send(body);
  }
}