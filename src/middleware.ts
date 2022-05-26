import type { Middleware } from "./types";
import type { HTTPMethod } from "./";

import { Response } from './response';

export const asJSON: Middleware = (handler) => async (request) => {
  const response = await handler(request);
  
  const newResponse = { 
    ...response, 
    body: JSON.stringify(response.body), 
    headers: { 
      ...response.headers, 
      'Content-Type': 'application/json'
    }
  };

  return newResponse;
}

export const asHTML: Middleware = (handler) => async (request) => {
  const response = await handler(request);
  
  const newResponse = { 
    ...response, 
    body: JSON.stringify(response.body), 
    headers: { 
      ...response.headers, 
      'Content-Type': 'text/html'
    }
  };

  return newResponse;
}


export const withMethod = (...methods: HTTPMethod[]): Middleware => (handler) => async (request) => {
  const { method } = request;

  if (! methods.includes(method)) {
    return Response.MethodNotAllowed();
  }

  const response = await handler(request);
  
  return response;
}