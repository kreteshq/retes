import { test } from "uvu";
import * as assert from 'uvu/assert';
import axios, { AxiosInstance } from "axios";
import FormData from "form-data";

import { ServerApp } from "../src";
import { Response } from "../src/response";
import { GET, POST, PUT, DELETE } from "../src/route";
import { asHTML, asJSON } from '../src/middleware';

import type { Handler, Request, } from "../src/types";

const ExplicitResponse: Response = {
  status: 200,
  headers: {},
  body: { hello: "Kretes" },
};

const identity = (_) => _;
const prepend = (handler: Handler) => async (request: Request) => {
  const r = await handler(request);

  return Response.OK(`Prefix -> ${r.body}`);
}

//
// R O U T E S
//

const GETs = [
  GET("/", (_) => new Response("Hello, GET!")),
  GET("/json-explicit-response", (_) => ExplicitResponse),
  GET("/json-helper-response", [asJSON, (_) => Response.OK({ hello: "Kretes" })]),
  GET("/json-created-response", [asJSON, (_) => Response.Created({ status: "Created!" })]),
  GET("/route-params/:name", ({ params }) => Response.OK({ hello: params.name })),
  GET("/query-params", ({ params: { search } }) => Response.OK({ search })),
  GET("/html-content", [asHTML, (_) =>
    Response.OK(
      "<h1>Retes - Typed, Declarative, Data-Driven Routing for Node.js</h1>"
    )
  ]),
  GET("/accept-header-1", ({ format }) => Response.OK(format)),
  GET("/explicit-format", ({ format }) => Response.OK(format)),
];

const POSTs = [
  POST("/post-json", ({ params: { name } }) => Response.OK(`Received -> ${name}`)),
  POST("/post-form", ({ params: { name } }) => Response.OK(`Received -> ${name}`)),
  POST("/upload", ({ files }) => {
    return Response.OK(`Uploaded -> ${files?.upload.name}`);
  }),
  POST("/", (_) => Response.OK("Hello, POST!")),
];

const PUTs = [PUT("/", (_) => Response.OK("Hello, PUT!"))];

const DELETEs = [DELETE("/", (_) => Response.OK("Hello, DELETE!"))];

const Compositions = [
  GET("/simple-compose", (_) => Response.OK("Simple Compose"), { middleware: [identity] }),
  GET("/prepend-compose", (_) => Response.OK("Prepend Compose"), { middleware: [prepend] }),
];

const routes = [...GETs, ...POSTs, ...PUTs, ...DELETEs, ...Compositions];

//
// B E F O R E  &  A F T E R
//

let http: AxiosInstance;
let server: ServerApp;

test.before(async () => {
  server = new ServerApp(routes);
  await server.start();

  http = axios.create({ baseURL: `http://localhost:${server.port}` });
});

test.after(async () => {
  await server.stop();
});

//
// T E S T S
//

test("the most simple routes", async () => {
  const { data: d1 } = await http.get("/");
  assert.is(d1, "Hello, GET!");

  const { data: d2 } = await http.post("/");
  assert.is(d2, "Hello, POST!");

  const { data: d3 } = await http.put("/");
  assert.is(d3, "Hello, PUT!");

  const { data: d4 } = await http.delete("/");
  assert.is(d4, "Hello, DELETE!");
});

test("returns string with implicit return", async () => {
  const { status, data } = await http.get("/");
  assert.is(status, 200);
  assert.is(data, "Hello, GET!");
});

test("returns json for explicit response", async () => {
  const { status, data } = await http.get("/json-explicit-response");
  assert.is(status, 200);
  assert.equal(data, { hello: "Kretes" });
});

test("returns json for `OK` helper response", async () => {
  const { status, data } = await http.get("/json-helper-response");
  assert.is(status, 200);
  assert.equal(data, { hello: "Kretes" });
});

test("returns json for `created` helper response", async () => {
  const { status, data, headers } = await http.get("/json-created-response");
  assert.is(status, 201);
  assert.is(headers["content-type"], "application/json");
  assert.equal(data, { status: "Created!" });
});

test("returns route params", async () => {
  const { data, status } = await http.get("/route-params/Kretes");
  assert.is(status, 200);
  assert.equal(data, { hello: "Kretes" });
});

test("returns query params", async () => {
  const { status, data } = await http.get("/query-params?search=Kretes");
  assert.is(status, 200);
  assert.equal(data, { search: "Kretes" });
});

test("returns HTML content", async () => {
  const { data, status, headers } = await http.get("/html-content");
  assert.is(status, 200);
  assert.is(headers["content-type"], "text/html");
  assert.is(
    data,
    "<h1>Retes - Typed, Declarative, Data-Driven Routing for Node.js</h1>"
  );
});

test("respects `Accept` header", async () => {
  const { data, status } = await http.get("/accept-header-1", {
    headers: {
      Accept: "text/plain",
    },
  });
  assert.is(status, 200);
  assert.is(data, "plain");
});

test("respects explicit format query param", async () => {
  const { data, status } = await http.get("/explicit-format?format=csv");
  assert.is(status, 200);
  assert.is(data, "csv");
});

test("accepts POST params as JSON", async () => {
  const { status, data } = await http.post("/post-json", {
    name: "Retes via JSON",
  });
  assert.is(status, 200);
  assert.is(data, "Received -> Retes via JSON");
});

test("accepts POST params as Form", async () => {
  const { stringify } = require("querystring");

  const { status, data } = await http.post(
    "/post-form",
    stringify({ name: "Retes via Form" })
  );
  assert.is(status, 200);
  assert.is(data, "Received -> Retes via Form");
});

// Compositions

test("compose functions & return string", async () => {
  const { status, data } = await http.get("/simple-compose");
  assert.is(status, 200);
  assert.is(data, "Simple Compose");
});

test("compose functions & append string", async () => {
  const { status, data } = await http.get("/prepend-compose");
  assert.is(status, 200);
  assert.is(data, "Prefix -> Prepend Compose");
});

// Errors

test("render an error page for a non-existing route", async () => {
  try {
    await http.get("/route-doesnt-exist-404");
  } catch (error) {
    const {
      response: { status, statusText },
    } = error;
    assert.is(status, 404);
    assert.is(statusText, "Not Found");
  }
});

// Varia

test("receives file upload", async () => {
  const fd = new FormData();

  fd.append("upload", "This is my upload", "foo.csv");

  const options = {
    headers: fd.getHeaders(),
  };

  const { status, data } = await http.post("/upload", fd, options);
  assert.is(status, 200);
  assert.is(data, "Uploaded -> foo.csv");
});

// HERE ---

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

test.run();