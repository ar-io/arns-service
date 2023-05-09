import { DefaultState, ParameterizedContext } from "koa";
import { Warp } from "warp-contracts";
import winston from "winston";

export type KoaState = {
  logger: winston.Logger;
  warp: Warp;
} & DefaultState;

export type KoaContext = ParameterizedContext<KoaState>;

export type PDNSRecordEntry = {
  endTimestamp: number;
  contractTxId: string;
  tier: string;
};

export type DeployedContractsRequestBody = {
  sourceCodeTxIds: string[];
};
