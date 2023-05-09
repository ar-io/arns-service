import { Warp } from "warp-contracts";

const requestMap: Map<string, Promise<any> | undefined> = new Map();

// TODO: we can put this in a interface/class
export async function getContractState(id: string, warp: Warp) {
  // validate request is new, if not return the existing promise (e.g. barrier synchronization)
  if (requestMap.get(id)) {
    return await requestMap.get(id);
  }

  const contract = warp.contract(id);
  // set cached value for multiple requests during initial promise
  requestMap.set(id, contract.readState());
  // await the response
  const { cachedValue } = await requestMap.get(id);
  // remove the cached value once it's been retrieved
  requestMap.delete(id);

  return cachedValue.state;
}
