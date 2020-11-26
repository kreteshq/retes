// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import * as z from 'zod';
import { ParseParams } from 'zod/lib/cjs/parser';

import { Response } from '../';

const { JSONPayload } = Response;

export const Validating = (schema: z.ZodSchema<unknown>, options?: ParseParams) => {
  return next => async request => {
    const { params } = request;
    const result = await schema.safeParseAsync(params, options);

    if (result.success === false) {
      return JSONPayload(result.error, 400);
    } else {
      return next(request);
    }
  };
};

