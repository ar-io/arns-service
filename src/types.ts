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
  evaluationOptions?: Partial<EvaluationOptions>;
};

export type EvaluatedReadInteraction = {
  result: any;
  evaluationOptions?: Partial<EvaluationOptions>;
};

// Error types

export class EvaluationError extends Error {}
export class NotFoundError extends Error {}
export class UnknownError extends Error {}
export class BadRequestError extends Error {}
