import Arweave from "arweave";

export async function getDeployedContractsForWallet(arweave: Arweave, params: {address: string, sourceCodeTxIds: string[]}){
    const { address, sourceCodeTxIds } = params;
    let hasNextPage = false;
    let cursor: string | undefined;
    const ids = new Set();
    do {

    const queryObject = {
        query: `
            { 
                transactions (
                    owners:["${address}"]
                    tags:[
                        {
                            name:"Contract-Src",
                            values:${JSON.stringify(sourceCodeTxIds.join(','))}
                        }
                    ],
                    sort: HEIGHT_DESC,
                    first: 100,
                    bundledIn: null,
                    ${cursor ? `after: ${cursor}` : ''}
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
            }`
        }

        const { status, ...response } = await arweave.api.post('/graphql', queryObject);

        if (status !== 200){
            throw Error(`Failed to fetch contracts for wallet. Status code: ${status}`);
        }
    
        if (response.data.data?.transactions?.edges?.length) {
            response.data.data.transactions.edges
                .map((e: any) => ({
                id: e.node.id,
                cursor: e.cursor,
                hasNextPage: !e.pageInfo?.hasNextPage,
                }))
                .forEach((c: {
                    id: string;
                    cursor: string;
                    hasNextPage: boolean;
                }) => {
                    ids.add(c.id);
                    cursor = c.cursor;
                    hasNextPage = c.hasNextPage ?? false;
                });
        }
    } while (hasNextPage)

    return {
        ids: [...ids]
    };
  };

  export async function getWalletInteractionsForContract(arweave: Arweave, params: {address: string, contractId: string}): Promise<{ interactions: Map<string, any> }>{
    const { address, contractId } = params;
    let hasNextPage = false;
    let cursor: string | undefined;
    const interactions = new Map<string, any>();
    do {

        const queryObject = {
            query: `
                { 
                    transactions (
                        owners:["${address}"],
                        tags:[
                            {
                                name:"Contract",
                                values:["${contractId}"]
                            }
                        ],
                        sort: HEIGHT_DESC,
                        first: 100,
                        bundledIn: null,
                        ${cursor ? `after: "${cursor}"` : ''}
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
                }`
        }

        const { status, ...response } = await arweave.api.post('/graphql', queryObject);
        if (status !== 200){
            throw Error(`Failed to fetch contracts for wallet. Status code: ${status}`);
        }
    
        if (response.data.data?.transactions?.edges?.length) {
            response.data.data.transactions.edges
                .map((e: any) => {
                    const interactionInput = e.node.tags.find((t: {name: string, value: string}) => t.name === "Input");
                    const parsedInput = JSON.parse(interactionInput.value);
                    return {
                        id: e.node.id,
                        input: parsedInput,
                        height: e.node.block.height,
                        cursor: e.cursor,
                        hasNextPage: e.pageInfo?.hasNextPage,
                    }
                })
                .forEach((c: {
                    id: string;
                    cursor: string;
                    height: number;
                    input: any;
                    hasNextPage: boolean;
                }) => {
                    interactions.set(c.id, {
                        height: c.height,
                        input: c.input
                    });
                    cursor = c.cursor;
                    hasNextPage = c.hasNextPage ?? false;
                });
        }
    } while (hasNextPage);
    return {
       interactions
    };
  };
