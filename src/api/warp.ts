import {
  EvalStateResult,
  EvaluationOptions,
  Warp,
} from "warp-contracts";
import { EVALUATION_TIMEOUT_MS, allowedContractTypes } from "../constants";
import { ContractType } from "../types";
import * as _ from "lodash";
import { EvaluationTimeoutError } from "../errors";
import { createHash } from "crypto";
const requestMap: Map<string, Promise<any> | undefined> = new Map();

export const DEFAULT_EVALUATION_OPTIONS: Partial<EvaluationOptions> = {};

function createQueryParamHash(evalOptions: Partial<EvaluationOptions>): string {
  // Function to calculate the hash of a string
  const hash = createHash("sha256");
  hash.update(JSON.stringify(evalOptions));
  return hash.digest("hex");
}

export class EvaluationError extends Error {
  constructor(message?: string) {
    super(message); 
  }
}

// TODO: we can put this in a interface/class and update the resolved type
export async function getContractState({
  id,
  warp,
  evaluationOptions = DEFAULT_EVALUATION_OPTIONS,
}: {
  id: string;
  warp: Warp;
  evaluationOptions?: Partial<EvaluationOptions>;
}): Promise<EvalStateResult<any>> {
  const evalHash = createQueryParamHash(evaluationOptions);
  const cacheId = `${id}-${evalHash}`;
  // validate request is new, if not return the existing promise (e.g. barrier synchronization)
  if (requestMap.get(cacheId)) {
    const { cachedValue } = await requestMap.get(cacheId);
    return cachedValue;
  }

  // use provided evaluation options
  const contract = warp.contract(id).setEvaluationOptions(evaluationOptions);
  // set cached value for multiple requests during initial promise
  requestMap.set(cacheId, contract.readState());
  try {
    // await the response
    const { cachedValue } = await requestMap.get(cacheId);
    // remove the cached value once it's been retrieved
    requestMap.delete(cacheId);
    return cachedValue;
  } catch (error) {
    // throw an eval here so we can properly return correct status code
    if (
      error instanceof Error &&
      // reference: https://github.com/warp-contracts/warp/blob/92e3ec4bffdea27abb791c38b77a115d7c8bd8f5/src/contract/EvaluationOptionsEvaluator.ts#L134-L162
      (error.message.includes("Cannot proceed with contract evaluation") || error.message.includes("Use contract.setEvaluationOptions"))
    ) {
      throw new EvaluationError(error.message);
    }
    throw error;
  }
}

export async function validateStateWithTimeout(
  id: string,
  warp: Warp,
  type?: ContractType,
  address?: string,
  evaluationOptions: Partial<EvaluationOptions> = DEFAULT_EVALUATION_OPTIONS
): Promise<unknown> {
  return Promise.race([
    validateStateAndOwnership(id, warp, type, address, evaluationOptions),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new EvaluationTimeoutError()),
        EVALUATION_TIMEOUT_MS
      )
    ),
  ]);
}

// TODO: this could be come a generic and return the full state of contract once validated
export async function validateStateAndOwnership(
  id: string,
  warp: Warp,
  type?: ContractType,
  address?: string,
  evaluationOptions: Partial<EvaluationOptions> = DEFAULT_EVALUATION_OPTIONS
): Promise<boolean> {
  const { state } = await getContractState({ id, warp, evaluationOptions });
  // TODO: use json schema validation schema logic. For now, these are just raw checks.
  const validateType =
    !type ||
    (type && type === "ant" && state["records"] && state["records"]["@"]);
  const validateOwnership =
    !address ||
    (address && state["owner"] === address) ||
    state["controller"] === address;
  return validateType && validateOwnership;
}

// validates that a provided query param is of a specific value
export function isValidContractType(
  type: string | string[] | undefined
): type is ContractType {
  if (type instanceof Array) {
    return false;
  }

  return !type || (!!type && _.includes(allowedContractTypes, type));
}
