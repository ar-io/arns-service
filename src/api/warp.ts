import { EvalStateResult, SourceType, Warp } from "warp-contracts";
import { allowedContractTypes } from "../constants";
import { ContractType } from "../types";
import * as _ from "lodash";

const requestMap: Map<string, Promise<any> | undefined> = new Map();
const EVALUATION_TIMEOUT_MS = 5000;

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
        () =>
          reject(`State evaluation exceeded limit of ${EVALUATION_TIMEOUT_MS}`),
        EVALUATION_TIMEOUT_MS
      )
    ),
  ]);
}

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

export function isValidContractType(type: string): type is ContractType {
  return _.includes(allowedContractTypes, type);
}
