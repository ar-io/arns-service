import { DefaultState, ParameterizedContext } from 'koa';
export type KoaContext = ParameterizedContext<DefaultState>;

export type PDNSRecordEntry = {
    endTimestamp: number,
    contractTxId: string,
    tier: string,
}
