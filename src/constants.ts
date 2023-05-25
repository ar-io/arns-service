export const PDNS_CONTRACT_ID_REGEX = "([a-zA-Z0-9-_s+]{43})";
export const PDNS_CONTRACT_FIELD_REGEX =
  "(balances|records|fees|tiers|ticker|owner|name|controller|approvedANTSourceCodeTxs|settings)";
export const PDNS_NAME_REGEX = "([a-zA-Z0-9-s+]{1,32})";
export const EVALUATION_TIMEOUT_MS = 5000;
export const allowedContractTypes = ["ant"] as const;
