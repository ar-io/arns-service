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

    it('should return 200 from prometheus', async () => {
      const { status, data } = await axios.get(`/arns_metrics`);
      expect(status).to.equal(200);
      expect(data).to.not.be.undefined;
    });

    it('should return 200 from swagger', async () => {
      const { status, data } = await axios.get(`/api-docs`);
      expect(status).to.equal(200);
      expect(data).to.not.be.undefined;
    });
  });

  describe('/v1', () => {
    describe('/contract', () => {
      describe('/:contractTxId', () => {
        it('should return the contract state and id without any evaluation options provided', async () => {
          const { status, data } = await axios.get(`/v1/contract/${id}`);
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, state, evaluationOptions } = data;
          expect(contractTxId).to.equal(id);
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

        it('should throw a 404 for a contract that does not exist/has not been mined', async () => {
          const { status } = await axios.get(
            '/v1/contract/kbtXub0JcZYfBn7-WUgkFQjKmZb4y5DY2nT8WovBhWY',
          );
          expect(status).to.equal(404);
        });
      });

      describe('/:contractTxId/interactions', () => {
        it('should return the contract interactions', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions } = data;
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal(contractInteractions);
        });
      });

      describe('/:contractTxId/interactions/:address', () => {
        it('should return the contract interactions for the provided address', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions/${walletAddress}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions } = data;
          expect(contractTxId).to.equal(id);
          // TODO: filter out interactions specific to the wallet address
          expect(interactions).to.deep.equal(contractInteractions);
        });
      });

      describe('/:contractTxId/:field', () => {
        for (const field of [
          'balances',
          'owner',
          'name',
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
            const { contractTxId } = data;
            expect(contractTxId).to.equal(id);
            expect(data[field]).to.not.be.undefined; // we haven't created any interactions
          });
        }

        it('should return a 404 for an invalid field', async () => {
          const { status } = await axios.get(
            `/v1/contract/${id}/invalid-field`,
          );
          expect(status).to.equal(404);
        });

        describe('/records?contractTxId', () => {
          it('should return all records if no filter provided', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId } = data;
            expect(contractTxId).to.equal(id);
            expect(Object.keys(data['records'])).to.have.length(2);
          });

          it('should return records that have contractTxId matching the query filter', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records?contractTxId=${process.env.DEPLOYED_ANT_CONTRACT_TX_ID}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId } = data;
            expect(contractTxId).to.equal(id);
            expect(Object.keys(data['records'])).to.have.length(1);
          });

          it('should return empty records if the contractTxId does not match any record object', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records?contractTxId=not-a-real-tx-id`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId } = data;
            expect(contractTxId).to.equal(id);
            expect(Object.keys(data['records'])).to.have.length(0);
          });
        });

        describe('/records/:name', () => {
          it('should return the owner of record name when available', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records/example`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, owner, record } = data;
            expect(contractTxId).to.equal(id);
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
            const { contractTxId, owner, record } = data;
            expect(contractTxId).to.equal(id);
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

        describe('/reserved/:name', () => {
          it('should returns true when a contract is reserved', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/reserved/reserved-name`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, reserved, details, evaluationOptions } = data;
            expect(contractTxId).to.equal(id);
            expect(reserved).to.be.true;
            expect(details).to.not.be.undefined;
            expect(evaluationOptions).to.not.be.undefined;
          });

          it('should returns false when a contract is not reserved', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/reserved/non-reserved-name`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, reserved, details, evaluationOptions } = data;
            expect(contractTxId).to.equal(id);
            expect(reserved).to.be.false;
            expect(details).to.be.undefined;
            expect(evaluationOptions).to.not.be.undefined;
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
            const { address, contractTxIds } = data;
            expect(address).to.equal(walletAddress);
            expect(contractTxIds).to.not.be.undefined;
            expect(contractTxIds).to.deep.equal(ids);
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
              const { address, contractTxIds } = data;
              expect(address).to.equal(walletAddress);
              expect(contractTxIds).to.not.be.undefined;
              expect(contractTxIds).to.deep.equal(ids);
            });

            it('should return the transferred contract for the new owner', async () => {
              const { status, data } = await axios.get(
                `/v1/wallet/${transferToAddress}/contracts`,
              );
              expect(status).to.equal(200);
              expect(data).to.not.be.undefined;
              const { address, contractTxIds } = data;
              expect(address).to.equal(transferToAddress);
              expect(contractTxIds).to.not.be.undefined;
              expect(contractTxIds).to.deep.equal([
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
            const { address, contractTxIds } = data;
            expect(address).to.equal(walletAddress);
            expect(contractTxIds).to.not.be.undefined;
            expect(contractTxIds).to.deep.equal([
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

      describe('/:address/contracts/:contractTxId/interactions', () => {
        it('should return the all the wallets contract interactions', async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contractTxId, interactions } = data;
          expect(address).to.equal(walletAddress);
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal(contractInteractions);
        });
      });
    });
  });
});
