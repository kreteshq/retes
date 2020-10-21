import Stream from 'stream';

export const handle = (context: any) => (result: any) => {
  if (null === result || undefined === result)
    throw new Error('No return statement in the handler');

  let { response } = context;

  let body, headers, type, encoding;

  if (typeof result === 'string' || result instanceof Stream) {
    body = result;
  } else {
    body = result.body;
    headers = result.headers;
    type = result.type;
    encoding = result.encoding;
  }

  if (body instanceof Function)
    throw new Error('You need to return a value not a function.')

  Object.assign(
    {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    headers
  );

  response.statusCode = result.statusCode || 200;

  for (var key in headers) {
    response.setHeader(key, headers[key]);
  }

  if (encoding) response.setHeader('Content-Encoding', encoding);

  if (Buffer.isBuffer(body)) {
    response.setHeader('Content-Type', type || 'application/octet-stream');
    response.setHeader('Content-Length', body.length);
    response.end(body);
    return;
  }

  if (body instanceof Stream) {
    if (!response.getHeader('Content-Type'))
      response.setHeader('Content-Type', type || 'text/html');

    body.pipe(response);
    return;
  }

  let str = body;

  if (typeof body === 'object' || typeof body === 'number') {
    str = JSON.stringify(body);
    response.setHeader('Content-Type', 'application/json');
  } else {
    if (!response.getHeader('Content-Type'))
      response.setHeader('Content-Type', type || 'text/plain');
  }

  response.setHeader('Content-Length', Buffer.byteLength(str));
  response.end(str);
};
