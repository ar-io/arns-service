/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { readFileSync } from 'fs';

import { koaSwagger } from 'koa2-swagger-ui';
import YAML from 'yaml';

import logger from '../logger';
import { KoaContext } from '../types';

function loadSwaggerYAML() {
  try {
    return YAML.parse(readFileSync('docs/openapi.yaml', 'utf8'));
  } catch (error) {
    logger.error(error);
    throw Error('OpenAPI spec could not be read!');
  }
}
export function swaggerDocsJSON(ctx: KoaContext) {
  ctx.response.body = JSON.stringify(loadSwaggerYAML(), null, 2);
}

export const swaggerDocs = koaSwagger({
  routePrefix: false,
  swaggerOptions: { spec: loadSwaggerYAML() },
});
