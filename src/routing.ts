// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import Debug from "debug";
const debug = Debug("retes:routing"); // eslint-disable-line no-unused-vars

import querystring from "querystring";
import { parse } from "url";
import busboy from "busboy";

import { isObject, parseCookies, parseAcceptHeader, toBuffer } from "./util";
import { Router } from "./router";

import type { Handler, KeyValue, Middleware, Params, Request } from "./types";

export const Routing = (router: Router): Middleware => {
  return (next: Handler) => async (request: Request) => {
    const method = request.method;
    const { pathname, query } = parse(request.url ?? "", true); // TODO Test perf vs RegEx

    const [handler, dynamicRoutes]: [Function, KeyValue[]] = router.find(
      method,
      pathname
    );

    const params = {} as Params;
    for (let r of dynamicRoutes) {
      params[r.name] = r.value;
    }

    if (handler !== undefined) {
      request.params = { ...query, ...params };
      await handleRequest(request);
      request.params = { ...request.params };
      return handler(request);
    } else {
      return next(request);
    }
  };
};

const handleRequest = async (request: Request) => {
  const { headers, params } = request;
  const { format } = params;

  request.headers = headers;
  request.cookies = parseCookies(headers.cookie);
  request.format = format ? format : parseAcceptHeader(headers);

  const buffer = await toBuffer(request.body);

  if (buffer.length > 0) {
    const contentType = headers["content-type"]?.split(";")[0];

    switch (contentType) {
      case "application/x-www-form-urlencoded":
        Object.assign(params, querystring.parse(buffer.toString()));
        break;
      case "application/json": {
        let result;

        try {
          result = JSON.parse(buffer.toString());
        } catch (error) {
          result = {};
        }

        if (isObject(result)) {
          Object.assign(params, result);
        }
        break;
      }
      case "multipart/form-data": {
        request.files = {};

        const bb = busboy({ headers });

        bb.on("file", (name, file, info) => {
          const { filename, encoding, mime } = info;

          file.on("data", (data) => {
            request.files = {
              ...request.files,
              [name]: {
                name: filename,
                length: data.length,
                data,
                encoding,
                mime,
              },
            };
          });
          file.on("close", () => {});
        });
        bb.on("field", (name, val) => {
          request.params = { ...request.params, [name]: val };
        });
        bb.end(buffer);

        await new Promise((resolve) => bb.on("close", resolve));

        break;
      }
      default:
    }
  }
};
