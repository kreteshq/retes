import type { Middleware } from "./types";

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
