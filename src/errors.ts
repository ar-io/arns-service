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
import { EVALUATION_TIMEOUT_MS } from './constants';

// TODO: we could put a prometheus metric here to help fine tune what our evaluation limit should be
export class BaseError extends Error {
  super(message: string) {
    this.message = message;
    this.name = this.constructor.name;
  }
}
export class EvaluationTimeoutError extends BaseError {
  constructor() {
    super(`State evaluation exceeded limit of ${EVALUATION_TIMEOUT_MS}ms.`);
  }
}
export class EvaluationError extends BaseError {}
export class NotFoundError extends BaseError {}
export class UnknownError extends BaseError {}
export class BadRequestError extends BaseError {}
