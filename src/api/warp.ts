import { EvalStateResult, EvaluationOptions, SourceType, Warp } from "warp-contracts";
import { EVALUATION_TIMEOUT_MS, allowedContractTypes } from "../constants";
import { ContractType } from "../types";
import * as _ from "lodash";
import { EvaluationTimeoutError } from "../errors";
import { createHash } from 'crypto';
const requestMap: Map<string, Promise<any> | undefined> = new Map();

function createQueryParamHash(evalOptions: Partial<EvaluationOptions>): string {
  // Function to calculate the hash of a string
  const hash = createHash('sha256');
  hash.update(evalOptions.toString());
  return hash.digest('hex');
}

// TODO: we can put this in a interface/class and update the resolved type
export async function getContractState(
  id: string,
  warp: Warp,
  evalOptions: Partial<EvaluationOptions> = {
    // restrain to L1 tx's only
    sourceType: SourceType.ARWEAVE,
    // TODO: these will need to match the contract or be provided as params
    unsafeClient: "skip",
    internalWrites: true,
    maxCallDepth: 3,
    waitForConfirmation: true,
    updateCacheForEachInteraction: true,
  }
): Promise<EvalStateResult<any>> {
  const evalHash = createQueryParamHash(evalOptions);
  const cacheId = `${id}-${evalHash}`;
  // validate request is new, if not return the existing promise (e.g. barrier synchronization)
  if (requestMap.get(cacheId)) {
    const { cachedValue } = await requestMap.get(cacheId);
    return cachedValue;
  }

  // use provided evaluation options
  const contract = warp.contract(id).setEvaluationOptions(evalOptions);

  // set cached value for multiple requests during initial promise
  requestMap.set(cacheId, contract.readState());
  // await the response
  const { cachedValue } = await requestMap.get(cacheId);
  // remove the cached value once it's been retrieved
  requestMap.delete(cacheId);

  return cachedValue;
}

export async function validateStateWithTimeout(
  id: string,
  warp: Warp,
  type?: ContractType,
  address?: string
): Promise<unknown> {
  return Promise.race([
    validateStateAndOwnership(id, warp, type, address),
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
  address?: string
): Promise<boolean> {
  const { state } = await getContractState(id, warp);
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
