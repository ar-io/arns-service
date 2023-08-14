import winston from 'winston';
import Arweave from 'arweave';
import { DefaultState, ParameterizedContext } from 'koa';
import { EvaluationOptions, PstState, Warp } from 'warp-contracts';
import { allowedContractTypes } from './constants';

// accessible across middleware and handlers
export type KoaState = {
  logger: winston.Logger;
  warp: Warp;
  arweave: Arweave;
  queryParams: QueryParameters;
} & DefaultState;

export type KoaContext = ParameterizedContext<KoaState>;

export type OptionalQueryParameters = {
  type: string;
};

export type QueryParameters = Partial<EvaluationOptions> &
  Partial<OptionalQueryParameters>;

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
