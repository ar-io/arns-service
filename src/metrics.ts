/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import * as promClient from 'prom-client';

// prometheus metric for errors
export const uncaughtExceptionError = new promClient.Counter({
  name: 'errors_total',
  help: 'Total uncaught exception error',
});

export const mismatchedInteractionCount = new promClient.Counter({
  name: 'mismatched_interactions_count',
  help: 'An interaction found via GQL was not evaluated by warp for a contract',
});
