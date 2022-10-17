import type { NextApiHandler, NextApiRequest } from 'next';
import type { HTTPMethod } from './';
import type { Handler, Params, Pipeline, Request } from './types';

import contentTypePkg from 'next/dist/compiled/content-type/index.js';
import getRawBody from 'next/dist/compiled/raw-body/index.js';
import isErrorPkg from 'next/dist/lib/is-error.js';
import { ApiError } from 'next/dist/server/api-utils/index.js';
import { IncomingMessage } from 'node:http';
import qs from 'querystring';
import URL from 'url';

import { composePipeline, isPipeline } from './util';

const { parse } = contentTypePkg;
const isError = isErrorPkg;

function parseJson(str: string): object {
	if (str.length === 0) {
		return {};
	}

	try {
		return JSON.parse(str);
	} catch (e) {
		throw new ApiError(400, 'Invalid JSON');
	}
}

export async function parseBody(
	req: IncomingMessage,
	limit: string | number,
): Promise<any> {
	let contentType;
	try {
		contentType = parse(req.headers['content-type'] || 'text/plain');
	} catch {
		contentType = parse('text/plain');
	}
	const { type, parameters } = contentType;
	const encoding = parameters.charset || 'utf-8';

	let buffer;

	try {
		buffer = await getRawBody(req, { encoding, limit });
	} catch (e) {
		if (isError(e) && e.type === 'entity.too.large') {
			throw new ApiError(413, `Body exceeded ${limit} limit`);
		} else {
			throw new ApiError(400, 'Invalid body');
		}
	}

	const rawBody = buffer.toString();

	if (type === 'application/json' || type === 'application/ld+json') {
		return {
			rawBody,
			body: parseJson(rawBody),
		};
	} else if (type === 'application/x-www-form-urlencoded') {
		return {
			rawBody,
			body: qs.decode(rawBody),
		};
	} else {
		return {
			rawBody,
			body: rawBody,
		};
	}
}

const fromNextRequest = async (req: NextApiRequest): Promise<Request> => {
	const { method, url, headers = {} } = req;
	const { host } = headers;

	let bodies;

	if (req.body === undefined) {
		bodies = await parseBody(req, '1mb');
	}

	const body = req.body ?? bodies.body;

	const { query } = URL.parse(url ?? '', true);

	const params = Object.assign({}, body || {}, query); // to fix the `[Object: null prototype]` warning

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
		response: null,
	};

	return request;
};

export const toNextHandler = <T = Params>(flow: Handler<T> | Pipeline<T>): NextApiHandler => {
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
	};
};
