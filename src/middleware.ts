import type { HTTPMethod } from './';
import type { Middleware } from './types';

import { ZodTypeAny } from 'zod';
import { Response } from './response';

export const asJSON: Middleware = (handler) => async (request) => {
	const response = await handler(request);

	const newResponse = {
		...response,
		body: JSON.stringify(response.body),
		headers: {
			...response.headers,
			'Content-Type': 'application/json',
		},
	};

	return newResponse;
};

export const asHTML: Middleware = (handler) => async (request) => {
	const response = await handler(request);

	const newResponse = {
		...response,
		body: JSON.stringify(response.body),
		headers: {
			...response.headers,
			'Content-Type': 'text/html',
		},
	};

	return newResponse;
};

export const withMethod = (...methods: HTTPMethod[]): Middleware => (handler) => async (request) => {
	const { method } = request;

	if (!methods.includes(method)) {
		return Response.MethodNotAllowed();
	}

	const response = await handler(request);

	return response;
};

type Schema = ZodTypeAny;

export const RequestValidator = (schema: Schema): Middleware => {
	return next => request => {
		const { params } = request;

		const data = schema.safeParse(params);

		// FIXME !data.success doesn't work in TS ??
		// TODO ask Michal
		if (data.success === false) {
			return Response.BadRequest(data.error.issues);
		}

		return next(request);
	};
};
