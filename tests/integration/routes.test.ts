import { describe } from 'mocha';
import { expect } from 'chai';
import axiosPackage from 'axios';
import { arweave, createLocalWallet, warp } from './setup.test';
import { JWKInterface } from 'warp-contracts';
import * as path from 'path';
import * as fs from 'fs';
import { ArNSInteraction } from '../../src/types';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = process.env.PORT ?? 3000;
const serviceURL = `http://${HOST}:${+PORT}`;
const axios = axiosPackage.create({
  baseURL: serviceURL,
  validateStatus: () => true, // don't throw errors
});
describe('PDNS Service Integration tests', () => {
  let ids: string[] = [];
  let id: string;
  let walletAddress: string;
  let transferToAddress: string;
  let walletJWK: JWKInterface;
  const contractInteractions: ArNSInteraction[] = [];

  before(async function () {
    // set a large timeout to 10 secs
    this.timeout(10_000);
    ids = [
      process.env.DEPLOYED_ANT_CONTRACT_TX_ID!,
      process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!,
    ];
    id = process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID!;
    walletAddress = process.env.PRIMARY_WALLET_ADDRESS!;

    // get the wallet
    walletJWK = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `./wallets/${walletAddress}.json`),
        'utf8',
      ),
    ) as unknown as JWKInterface;

    expect(id).to.not.be.undefined;
    expect(id!.length).to.equal(43);
    expect(walletAddress).to.not.be.undefined;
    expect(walletAddress!.length).to.equal(43);
    expect(walletJWK).to.not.be.undefined;

    // create a transfer interaction
    const { address } = await createLocalWallet(arweave);
    const contract = warp.contract(id!).connect(walletJWK!);
    const transferInteraction = {
      function: 'transfer',
      target: address,
      qty: 1,
    };
    const writeInteraction = await contract.writeInteraction(
      transferInteraction,
      {
        disableBundling: true,
      },
    );
    expect(writeInteraction?.originalTxId).to.not.be.undefined;
    transferToAddress = address;
    contractInteractions.push({
      height: (await arweave.blocks.getCurrent()).height,
      input: transferInteraction,
      owner: walletAddress,
      valid: true,
      id: writeInteraction!.originalTxId,
    });
  });

  describe('general routes', () => {
    it('should return 200 from healthcheck', async () => {
      const { status, data } = await axios.get(`/healthcheck`);
      expect(status).to.equal(200);
      expect(data).to.not.be.undefined;
    });

    it('should return 200 prometheus', async () => {
      const { status, data } = await axios.get(`/arns_metrics`);
      expect(status).to.equal(200);
      expect(data).to.not.be.undefined;
    });
  });

  describe('/v1', () => {
    describe('/contract', () => {
      describe('/:id', () => {
        it('should return the contract state and id without any evaluation options provided', async () => {
          const { status, data } = await axios.get(`/v1/contract/${id}`);
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contract, state, evaluationOptions } = data;
          expect(contract).to.equal(id);
          expect(evaluationOptions).not.to.be.undefined;
          expect(state).to.include.keys([
            'balances',
            'owner',
            'name',
            'records',
            'ticker',
            'owner',
            'controller',
          ]);
        });

        it('should return a 404 for an invalid id', async () => {
          const { status } = await axios.get(`/v1/contract/non-matching-regex`);
          expect(status).to.equal(404);
        });

        it('should return an error when evaluation option is less restrictive then the contract-manifest', async () => {
          const { status } = await axios.get(
            `/v1/contract/${id}?throwOnInternalWriteError=false`,
          );
          expect(status).to.equal(400);
        });
      });

      describe('/:id/interactions', () => {
        it('should return the contract interactions', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contract, interactions } = data;
          expect(contract).to.equal(id);
          expect(interactions).to.deep.equal(contractInteractions);
        });
      });

      describe('/:id/:field', () => {
        for (const field of [
          'balances',
          'owner',
          'name',
          'records',
          'ticker',
          'owner',
          'controller',
          'auctions',
          'reserved',
        ]) {
          it(`should return the correct state value for ${field}`, async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/${field}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contract } = data;
            expect(contract).to.equal(id);
            expect(data[field]).to.not.be.undefined; // we haven't created any interactions
          });
        }

        it('should return a 404 for an invalid field', async () => {
          const { status } = await axios.get(
            `/v1/contract/${id}/invalid-field`,
          );
          expect(status).to.equal(404);
        });
        describe('/records/:name', () => {
          it('should return the owner of record name when available', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records/example`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contract, owner, record } = data;
            expect(contract).to.equal(id);
            expect(record).to.deep.equal({
              contractTxId: process.env.DEPLOYED_ANT_CONTRACT_TX_ID,
            });
            expect(owner).to.not.be.undefined;
            expect(owner).to.equal(walletAddress);
          });

          it('should not return the owner of a record name if the contractTxId does not exist on the record', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records/no-owner`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contract, owner, record } = data;
            expect(contract).to.equal(id);
            expect(record).to.not.be.undefined;
            expect(owner).to.be.undefined;
          });

          it('should return a 404 when the record name does not exist', async () => {
            const { status } = await axios.get(
              `/v1/contract/${id}/records/fake-name`,
            );
            expect(status).to.equal(404);
          });
        });
      });
    });

    describe('/wallet', () => {
      describe('/:address/contracts', () => {
        describe('no query params provided', () => {
          it('should return the list of contracts owned or controlled by a wallet', async () => {
            const { status, data } = await axios.get(
              `/v1/wallet/${walletAddress}/contracts`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { address, contractIds } = data;
            expect(address).to.equal(walletAddress);
            expect(contractIds).to.not.be.undefined;
            expect(contractIds).to.deep.equal(ids);
          });
          it('should return a 404 for an invalid wallet address', async () => {
            const { status } = await axios.get(
              `/v1/wallet/non-matching-regex/contracts`,
            );
            expect(status).to.equal(404);
          });

          describe('a transferred contract', () => {
            it('should return the transferred contract for the original owner', async () => {
              const { status, data } = await axios.get(
                `/v1/wallet/${walletAddress}/contracts`,
              );
              expect(status).to.equal(200);
              expect(data).to.not.be.undefined;
              const { address, contractIds } = data;
              expect(address).to.equal(walletAddress);
              expect(contractIds).to.not.be.undefined;
              expect(contractIds).to.deep.equal(ids);
            });

            it('should return the transferred contract for the new owner', async () => {
              const { status, data } = await axios.get(
                `/v1/wallet/${transferToAddress}/contracts`,
              );
              expect(status).to.equal(200);
              expect(data).to.not.be.undefined;
              const { address, contractIds } = data;
              expect(address).to.equal(transferToAddress);
              expect(contractIds).to.not.be.undefined;
              expect(contractIds).to.deep.equal([
                process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID,
              ]);
            });
          });
        });

        describe('?type=', () => {
          it('should return the list of contracts owned or controlled by a wallet and of a specific ant type', async () => {
            const { status, data } = await axios.get(
              `/v1/wallet/${walletAddress}/contracts?type=ant`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { address, contractIds } = data;
            expect(address).to.equal(walletAddress);
            expect(contractIds).to.not.be.undefined;
            expect(contractIds).to.deep.equal([
              process.env.DEPLOYED_ANT_CONTRACT_TX_ID,
            ]);
          });

          it('should return return a 400 when an invalid type is provided', async () => {
            const { status, data } = await axios.get(
              `/v1/wallet/${walletAddress}/contracts?type=invalid`,
            );
            expect(status).to.equal(400);
            expect(data).to.contain('Invalid type.');
          });
        });
      });

      describe('/:address/contracts/:id/interactions', () => {
        it('should return the all the wallets contract interactions', async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contract, interactions } = data;
          expect(address).to.equal(walletAddress);
          expect(contract).to.equal(id);
          expect(interactions).to.deep.equal(contractInteractions);
        });
      });
    });
  });
});
