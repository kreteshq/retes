import type { Handler, Pipeline, Request } from "./types";
import type { NextApiHandler, NextApiRequest } from 'next';
import { composePipeline, isPipeline } from "./util";

const fromNextRequest = (req: NextApiRequest): Request => {
  const { method, url, headers = {} } = req;
  const { host } = headers;
  const request: Request = {
    params: {},
    context: {},
    headers,
    host,
    method,
    url,
    body: req.body,
    // FIXME
    response: null
  };

  return request;
}

export const toNextHandler = (flow: Handler | Pipeline): NextApiHandler => {
  // FIXME handle empty array
  // FIXME handle one element array

  const handler =  isPipeline(flow) && flow.length > 1 ? composePipeline(flow) : flow as Handler; 

  return async (req, res) => {
    const response = await handler(fromNextRequest(req));
    const { body, status, headers } = response;

    for (var key in headers) {
      res.setHeader(key, headers[key]);
    }

    res.status(status).send(body);
  }
}