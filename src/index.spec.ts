import test from 'ava';
import axios from 'axios';
import FormData from 'form-data';

import { Route, Response, App } from '.';
import { Next, Request } from './types';

const { before, after } = test;

const { GET, POST, PUT, DELETE } = Route;
const { OK, Created, HTMLString } = Response;

const ExplicitResponse = {
  statusCode: 200,
  headers: {},
  body: { hello: 'Kretes' },
};

const identity = _ => _;
const prepend = (next: Next) => async (request: Request) => `Prefix -> ${await next(request)}`;

//
// R O U T E S
//

const GETs = [
  GET('/', _ => 'Hello, GET!'),
  GET('/json-explicit-response', _ => ExplicitResponse),
  GET('/json-helper-response', _ => OK({ hello: 'Kretes' })),
  GET('/json-created-response', _ => Created({ status: 'Created!' })),
  GET('/route-params/:name', ({ params }) => OK({ hello: params.name })),
  GET('/query-params', ({ params: { search } }) => OK({ search })),
  GET('/html-content', _ => HTMLString('<h1>Retes - Typed, Declarative, Data-Driven Routing for Node.js</h1>')),
  GET('/accept-header-1', ({ format }) => OK(format)),
  GET('/explicit-format', ({ format }) => OK(format))
];

const POSTs = [
  POST('/post-json', ({ params: { name } }) => `Received -> ${name}`),
  POST('/post-form', ({ params: { name } }) => `Received -> ${name}`),
  POST('/upload', ({ files }) => {
    return `Uploaded -> ${files.upload.name}`;
  }),
  POST('/', _ => 'Hello, POST!'),
];

const PUTs = [
  PUT('/', _ => 'Hello, PUT!'),
]

const DELETEs = [
  DELETE('/', _ => 'Hello, DELETE!')
]

const Compositions = [
  GET('/simple-compose', _ => 'Simple Compose', { middleware: [identity] }),
  GET('/prepend-compose', _ => 'Prepend Compose', { middleware: [prepend] }),
];

const routes = [].concat(GETs, POSTs, PUTs, DELETEs, Compositions);

//
// B E F O R E  &  A F T E R
//

let http;
let server;

before(async () => {
  server = new App(routes);
  await server.start();

  http = axios.create({ baseURL: `http://localhost:${server.port}` });
});

after(async () => {
  await server.stop();
})

//
// T E S T S
//

test('the most simple routes', async assert => {
  const { data: d1 } = await http.get('/');
  assert.is(d1, 'Hello, GET!');

  const { data: d2 } = await http.post('/');
  assert.is(d2, 'Hello, POST!');

  const { data: d3 } = await http.put('/');
  assert.is(d3, 'Hello, PUT!');

  const { data: d4 } = await http.delete('/');
  assert.is(d4, 'Hello, DELETE!');

})

test('returns string with implicit return', async assert => {
  const { status, data } = await http.get('/');
  assert.is(status, 200);
  assert.is(data, 'Hello, GET!');
});

test('returns json for explicit response', async assert => {
  const { status, data } = await http.get('/json-explicit-response');
  assert.is(status, 200);
  assert.deepEqual(data, { hello: 'Kretes' });
});

test('returns json for `OK` helper response', async assert => {
  const { status, data } = await http.get('/json-helper-response');
  assert.is(status, 200);
  assert.deepEqual(data, { hello: 'Kretes' });
});

test('returns json for `created` helper response', async assert => {
  const { status, data, headers } = await http.get('/json-created-response');
  assert.is(status, 201);
  assert.is(headers['content-type'], 'application/json');
  assert.deepEqual(data, { status: 'Created!' });
});

test('returns route params', async assert => {
  const { data, status }= await http.get('/route-params/Kretes');
  assert.is(status, 200);
  assert.deepEqual(data, { hello: 'Kretes' });
});

test('returns query params', async assert => {
  const { status, data } = await http.get('/query-params?search=Kretes');
  assert.is(status, 200);
  assert.deepEqual(data, { search: 'Kretes' });
});

test('returns HTML content', async assert => {
  const { data, status, headers } = await http.get('/html-content');
  assert.is(status, 200);
  assert.is(headers['content-type'], 'text/html');
  assert.is(data, '<h1>Retes - Typed, Declarative, Data-Driven Routing for Node.js</h1>');
});

test('respects `Accept` header', async assert => {
  const { data, status } = await http.get('/accept-header-1', {
    headers: {
      Accept: 'text/plain',
    }
  });
  assert.is(status, 200);
  assert.is(data, 'plain');
});

test('respects explicit format query param', async assert => {
  const { data, status } = await http.get('/explicit-format?format=csv');
  assert.is(status, 200);
  assert.is(data, 'csv');
});

test('accepts POST params as JSON', async assert => {
  const { status, data } = await http.post('/post-json', {
    name: 'Retes via JSON',
  });
  assert.is(status, 200);
  assert.is(data, 'Received -> Retes via JSON');
});

test('accepts POST params as Form', async assert => {
  const { stringify } = require('querystring');

  const { status, data } = await http.post('/post-form', stringify({ name: 'Retes via Form' }));
  assert.is(status, 200);
  assert.is(data, 'Received -> Retes via Form');
});

// Compositions

test('compose functions & return string', async assert => {
  const { status, data } = await http.get('/simple-compose');
  assert.is(status, 200);
  assert.is(data, 'Simple Compose');
});

test('compose functions & append string', async assert => {
  const { status, data } = await http.get('/prepend-compose');
  assert.is(status, 200);
  assert.is(data, 'Prefix -> Prepend Compose');
});

// Errors

test('render an error page for a non-existing route', async assert => {
  try {
    await http.get('/route-doesnt-exist-404')
  } catch (error) {
    const { response: { status, statusText }} = error
    assert.is(status, 404);
    assert.is(statusText, 'Not Found');
  }
});

// Varia

test('receives file upload', async assert => {
  const fd = new FormData();

  fd.append('upload', 'This is my upload', 'foo.csv');

  const options = {
    headers: fd.getHeaders()
  };

  const { status, data } = await http.post('/upload', fd, options);
  assert.is(status, 200);
  assert.is(data, 'Uploaded -> foo.csv');
});


/*


test('sets security headers by default', async assert => {
  const { headers } = await http.get('/');
  assert.is(headers['x-download-options'], 'noopen');
  assert.is(headers['x-content-type-options'], 'nosniff');
  assert.is(headers['x-xss-protection'], '1; mode=block');
  assert.is(true, true);
});

test('built-in validation with invalid request', async assert => {
  try {
    await get('/request-validation');
  } catch ({ response: { status, data } }) {
    assert.is(status, 422);
    assert.deepEqual(data, ['name is required.']);
  }
});

test('built-in validation with valid request', async assert => {
  const { status, data } = await get('/request-validation?name=Zaiste');
  assert.is(status, 200);
  assert.is(data, 'Admin param (undefined) should be absent from this request payload');
});

test('built-in validation strips undefined params', async assert => {
  const { status, data } = await get('/request-validation?name=Zaiste&admin=true');
  assert.is(status, 200);
  assert.is(data, 'Admin param (undefined) should be absent from this request payload');
});


*/
