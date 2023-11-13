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
import winston, { format, transports } from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const LOG_FORMAT = process.env.LOG_FORMAT ?? 'json';

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format((info) => {
      // Only log stack traces when the log level is error
      if (info.stack && info.level !== 'error') {
        delete info.stack;
      }
      return info;
    })(),
    format.errors(),
    format.timestamp(),
    LOG_FORMAT === 'json' ? format.json() : format.simple(),
  ),
  transports: new transports.Console(),
});

export default logger;
