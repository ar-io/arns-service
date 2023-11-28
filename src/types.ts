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
import winston from 'winston';
import Arweave from 'arweave';
import { DefaultState, ParameterizedContext } from 'koa';
import {
  EvalStateResult,
  EvaluationOptions,
  PstState,
  Warp,
} from 'warp-contracts';
import { allowedContractTypes } from './constants';

// Koa types
export type KoaState = {
  logger: winston.Logger;
  warp: Warp;
  arweave: Arweave;
} & DefaultState;

export type KoaContext = ParameterizedContext<KoaState>;

// ArNS types

export type ArNSRecord = {
  transactionId: string;
  [x: string]: string | number;
};

export type ArNSState = PstState & { records: { [x: string]: ArNSRecord } };

export type PstInput = {
  function: string;
  [x: string]: string | number;
};

export type ArNSInteraction = {
  id: string;
  valid: boolean;
  input: PstInput | undefined;
  height: number;
  owner: string;
  sortKey: string;
  timestamp: number;
  errorMessage?: string;
};

export type ArNSContractInteractions = {
  [x: string]: ArNSInteraction;
};

export type ContractType = (typeof allowedContractTypes)[number];

// Response types

export type ContractBaseResponse = {
  contractTxId: string;
  evaluationOptions?: Partial<EvaluationOptions>;
};

export type ContractRecordResponse = ContractBaseResponse & {
  record: unknown;
  owner?: string;
  name: string;
};

export type ContractReservedResponse = ContractBaseResponse & {
  reserved: boolean;
  details?: unknown;
  name: string; // TODO: abstract to higher type
};

// Warp types

export type EvaluatedContractState = EvalStateResult<any> & {
  evaluationOptions: Partial<EvaluationOptions>;
  sortKey: string;
};

export type EvaluatedReadInteraction = {
  result: any;
  evaluationOptions?: Partial<EvaluationOptions>;
};
