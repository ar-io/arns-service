import { EvalStateResult, SourceType, Warp } from "warp-contracts";
import { EVALUATION_TIMEOUT_MS, allowedContractTypes } from "../constants";
import { ContractType } from "../types";
import * as _ from "lodash";
import { EvaluationTimeoutError } from "../errors";

const requestMap: Map<string, Promise<any> | undefined> = new Map();

// TODO: we can put this in a interface/class and update the resolved type
export async function getContractState(
  id: string,
  warp: Warp
): Promise<EvalStateResult<any>> {
  // validate request is new, if not return the existing promise (e.g. barrier synchronization)
  if (requestMap.get(id)) {
    const { cachedValue } = await requestMap.get(id);
    return cachedValue;
  }

  const contract = warp.contract(id).setEvaluationOptions({
    // restrain to L1 tx's only
    sourceType: SourceType.ARWEAVE,
  });
  // set cached value for multiple requests during initial promise
  requestMap.set(id, contract.readState());
  // await the response
  const { cachedValue } = await requestMap.get(id);
  // remove the cached value once it's been retrieved
  requestMap.delete(id);

  return cachedValue;
}

export async function validateStateWithTimeout(
  id: string,
  warp: Warp,
  type: ContractType
): Promise<unknown> {
  return Promise.race([
    validateState(id, warp, type),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new EvaluationTimeoutError()),
        EVALUATION_TIMEOUT_MS
      )
    ),
  ]);
}

// TODO: this could be come a generic and return the full state of contract once validated
export async function validateState(
  id: string,
  warp: Warp,
  type: ContractType
): Promise<boolean> {
  const { state } = await getContractState(id, warp);
  if (type === "ant" && state["records"] && state["records"]["@"]) {
    // TODO: use json schema validation schema logic. For now, these are just raw checks.
    return true;
  }
  return false;
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
