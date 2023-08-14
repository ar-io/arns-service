import { Next } from 'koa';
import { DEFAULT_EVALUATION_OPTIONS } from '../constants';
import { KoaContext, QueryParameters } from '../types';
import { ParsedUrlQuery } from 'querystring';

// Small util to parse evaluation options query params - we may want to use a library to help with this for other types
export function decodeQueryParams(
  queryParams: ParsedUrlQuery,
): QueryParameters {
  return Object.entries(queryParams).reduce(
    (
      decodedEvalOptions: {
        [key: string]: string | boolean;
      },
      [key, value]: [string, unknown],
    ) => {
      let parsedValue: string | boolean = value as string;
      // take only the first value if provided an array
      if (Array.isArray(value)) {
        parsedValue = value[0] as string; // take the first one
      }
      if (parsedValue === 'true' || parsedValue === 'false') {
        parsedValue = parsedValue === 'true'; // convert it to a boolean type
      }
      decodedEvalOptions[key] = parsedValue;
      return decodedEvalOptions;
    },
    {},
  );
}

export async function queryParamsMiddleware(ctx: KoaContext, next: Next) {
  // query params can be set for contracts with various eval options
  const queryParams = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;

  ctx.state.queryParams = queryParams;
  return next();
}
