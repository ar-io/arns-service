import { DefaultState, ParameterizedContext } from "koa";
import { PstState, Warp } from "warp-contracts";
import winston from "winston";

export type KoaState = {
  logger: winston.Logger;
  warp: Warp;
} & DefaultState;

export type KoaContext = ParameterizedContext<KoaState>;

export type DeployedContractsRequestBody = {
  sourceCodeTxIds: string[];
};

export type ArNSRecord = {
  transactionId: string,
  [x: string]: any
}

export type ArNSState = PstState & { records: { [x:string]: ArNSRecord } }

export type PstInput = {
  function: string,
  [x: string]: string
}

export type ArNSInteraction = {
  valid: boolean,
  input: PstInput,
  height: number,
  errorMessage?: string,
}

export type ArNSContractInteractions = {
  [x: string]: ArNSInteraction
}
