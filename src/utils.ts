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
import { MAX_PATH_DEPTH } from './constants';
export function traverseObject<T>({
  object,
  path,
}: {
  object: any; // TODO: scope this to a type that can be traversed
  path: string[];
}): T {
  //  base case - protect against endless recursion and/or return the object if we've reached the end of the path
  if (
    path.length > MAX_PATH_DEPTH ||
    path.length === 0 ||
    object === undefined
  ) {
    return object;
  }
  return traverseObject<T>({
    object: object[path[0]],
    path: path.slice(1),
  });
}
