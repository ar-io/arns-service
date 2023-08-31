import { EvaluationOptions } from 'warp-contracts';

export const ARNS_CONTRACT_ID_REGEX = '([a-zA-Z0-9-_s+]{43})';
export const ARNS_CONTRACT_FIELD_REGEX =
  '(balances|records|fees|ticker|owner|name|controller|auctions|settings|reserved|gateways|version)';
export const ARNS_NAME_REGEX = '([a-zA-Z0-9-s+]{1,32})';
export const EVALUATION_TIMEOUT_MS = 10_000; // 10 sec state timeout
export const allowedContractTypes = ['ant'] as const;
export const DEFAULT_EVALUATION_OPTIONS: Partial<EvaluationOptions> = {};
