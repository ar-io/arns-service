import Arweave from "arweave";
import { ArNSInteraction } from "../types.js";

export const MAX_REQUEST_SIZE = 100;

export async function getDeployedContractsByWallet(
  arweave: Arweave,
  params: { address: string }
): Promise<{ ids: string[] }> {
  const { address } = params;
  let hasNextPage = false;
  let cursor: string | undefined;
  const ids = new Set<string>();
  do {
    const queryObject = {
      query: `
      { 
          transactions (
              owners:["${address}"]
              tags:[
                {
                  name: "App-Name",
                  values: ["SmartWeaveContract"]
                },
              ],
              sort: HEIGHT_DESC,
              first: ${MAX_REQUEST_SIZE},
              bundledIn: null,
              ${cursor ? `after: "${cursor}"` : ""}
          ) {
              pageInfo {
                  hasNextPage
              }
              edges {
                  cursor
                  node {
                      id
                      block {
                          height
                      }
                  }
              }
          }
      }`,
    };

    const { status, ...response } = await arweave.api.post(
      "/graphql",
      queryObject
    );
    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`
      );
    }

    if (response.data.data?.transactions?.edges?.length) {
      response.data.data.transactions.edges
        .map((e: any) => ({
          id: e.node.id,
          cursor: e.cursor,
          hasNextPage: e.pageInfo?.hasNextPage,
        }))
        .forEach((c: { id: string; cursor: string; hasNextPage: boolean }) => {
          ids.add(c.id);
          cursor = c.cursor;
          hasNextPage = c.hasNextPage ?? false;
        });
    }
  } while (hasNextPage);

  return {
    ids: [...ids],
  };
}

export async function getWalletInteractionsForContract(
  arweave: Arweave,
  params: { address?: string; contractId: string }
): Promise<{
  interactions: Map<
    string,
    Omit<ArNSInteraction, "valid" | "errorMessage" | "id">
  >;
}> {
  const { address, contractId } = params;
  let hasNextPage = false;
  let cursor: string | undefined;
  const interactions = new Map<
    string,
    Omit<ArNSInteraction, "valid" | "errorMessage" | "id">
  >();
  do {
    const queryObject = {
      query: `
        { 
            transactions (
                owners: ${address ? `["${address}"]` : "[]"},
                tags:[
                    {
                        name:"Contract",
                        values:["${contractId}"]
                    }
                ],
                sort: HEIGHT_DESC,
                first: ${MAX_REQUEST_SIZE},
                bundledIn: null,
                ${cursor ? `after: "${cursor}"` : ""}
            ) {
                pageInfo {
                    hasNextPage
                }
                edges {
                    cursor
                    node {
                        id
                        owner {
                          address
                        }
                        tags {
                            name
                            value
                        }
                        block {
                            height
                        }
                    }
                }
            }
        }`,
    };

    const { status, ...response } = await arweave.api.post(
      "/graphql",
      queryObject
    );
    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`
      );
    }

    if (response.data.data?.transactions?.edges?.length) {
      response.data.data.transactions.edges.forEach((e: any) => {
        const interactionInput = e.node.tags.find(
          (t: { name: string; value: string }) => t.name === "Input"
        );
        const parsedInput = interactionInput
          ? JSON.parse(interactionInput.value)
          : undefined;
        interactions.set(e.node.id, {
          height: e.node.block.height,
          input: parsedInput,
          owner: e.node.owner.address,
        });
      });
      cursor =
        response.data.data.transactions.edges[MAX_REQUEST_SIZE - 1]?.cursor ??
        undefined;
      hasNextPage =
        response.data.data.transactions.pageInfo?.hasNextPage ?? false;
    }
  } while (hasNextPage);
  return {
    interactions,
  };
}

export async function getContractsTransferredToOrControlledByWallet(
  arweave: Arweave,
  params: { address: string }
): Promise<{ ids: string[] }> {
  const { address } = params;
  let hasNextPage = false;
  let cursor: string | undefined;
  const ids = new Set<string>();
  do {
    const queryObject = {
      query: `
          { 
              transactions (
                  tags:[
                    {
                      name: "App-Name",
                      values: ["SmartWeaveAction"]
                    },
                    {
                      name: "Input",
                      values: ${JSON.stringify([
                        {
                          function: "setController",
                          target: address,
                        },
                        {
                          function: "transfer",
                          target: address,
                          qty: 1,
                        },
                      ])
                        .replace(/"/g, '\\"')
                        .replace(/\{/g, '"{')
                        .replace(/\}/g, '}"')}
                   }
                  ],
                  sort: HEIGHT_DESC,
                  first: ${MAX_REQUEST_SIZE},
                  bundledIn: null,
                  ${cursor ? `after: "${cursor}"` : ""}
              ) {
                  pageInfo {
                      hasNextPage
                  }
                  edges {
                      cursor
                      node {
                          id
                          tags {
                            name
                            value
                          }
                          block {
                              height
                          }
                      }
                  }
              }
          }`,
    };

    const { status, ...response } = await arweave.api.post(
      "/graphql",
      queryObject
    );
    if (status !== 200) {
      throw Error(
        `Failed to fetch contracts for wallet. Status code: ${status}`
      );
    }

    const ignoreNextInteractionContracts: string[] = [];

    if (response.data.data?.transactions?.edges?.length) {
      response.data.data.transactions.edges
        .map((e: any) => {
          // get the contract id of the interaction
          const contractTag = e.node.tags.find(
            (t: { name: string; value: string }) => t.name === "Contract"
          );

          // we don't care about older interactions, only the most recent one and the query is ordered based an ascending value
          // there is likely a faster way to do this
          if (ignoreNextInteractionContracts.includes(contractTag)) {
            return null;
          }
          // add it to the contract interactions to ignore list
          ignoreNextInteractionContracts.push(contractTag.value);
          return {
            id: contractTag.value,
            cursor: e.cursor,
            hasNextPage: e.pageInfo?.hasNextPage,
          };
        })
        .forEach((c: { id: string; cursor: string; hasNextPage: boolean }) => {
          ids.add(c.id);
          cursor = c.cursor;
          hasNextPage = c.hasNextPage ?? false;
        });
    }
  } while (hasNextPage);

  return {
    ids: [...ids],
  };
}
