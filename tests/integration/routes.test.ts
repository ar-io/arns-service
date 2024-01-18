/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { describe } from 'mocha';
import { expect } from 'chai';
import axiosPackage from 'axios';
import { arweave, createLocalWallet, warp } from './setup.test';
import {
  JWKInterface,
  LexicographicalInteractionsSorter,
} from 'warp-contracts';
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
describe('Integration tests', () => {
  let ids: string[] = [];
  let id: string;
  let walletAddress: string;
  let transferToAddress: string;
  let walletJWK: JWKInterface;
  const contractInteractions: ArNSInteraction[] = [];
  const interactionSorter = new LexicographicalInteractionsSorter(arweave);

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

    /**
     * TODO: there is an issue in arlocal where maxHeight of 0 is not getting respected - once resolved we can remove this call and update the /interactions tests
     * https://github.com/textury/arlocal/issues/148
     */
    await arweave.api.get('mine');

    // create a write interaction we can test against
    const writeInteraction = await contract.writeInteraction(
      transferInteraction,
      {
        disableBundling: true,
      },
    );
    expect(writeInteraction?.originalTxId).to.not.be.undefined;
    transferToAddress = address;
    const interactionBlock = await arweave.blocks.getCurrent();
    contractInteractions.push({
      height: interactionBlock.height,
      input: transferInteraction,
      owner: walletAddress,
      timestamp: Math.floor(interactionBlock.timestamp / 1000),
      sortKey: await interactionSorter.createSortKey(
        interactionBlock.indep_hash,
        writeInteraction!.originalTxId,
        interactionBlock.height,
      ),
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
        it('should not evaluate blocklisted contracts', async () => {
          const blocklistedContractTxId = process.env.BLOCKLISTED_CONTRACTS;
          const { status, data } = await axios.get(
            `/v1/contract/${blocklistedContractTxId}`,
          );
          expect(status).to.equal(403);
          expect(data.message).to.equal('Contract is blocklisted.');
        });
        it('should return the contract state and id and default evaluation options', async () => {
          const { status, data } = await axios.get(`/v1/contract/${id}`);
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, state, evaluationOptions, sortKey } = data;
          expect(contractTxId).to.equal(id);
          expect(evaluationOptions).not.to.be.undefined;
          expect(sortKey).not.be.undefined;
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

        it('should return a 400 on invalid block height query param', async () => {
          // block height before the interactions were created
          const invalidBlockHeight = 'not-a-number';

          const { status } = await axios.get(
            `/v1/contract/${id}/interactions?blockHeight=${invalidBlockHeight}`,
          );
          expect(status).to.equal(400);
        });

        it('should return a 400 on invalid sortKey height query param', async () => {
          // block height before the interactions were created
          const invalidSortKey = 'not-a-sort-key';

          const { status } = await axios.get(
            `/v1/contract/${id}/interactions?sortKey=${invalidSortKey}`,
          );
          expect(status).to.equal(400);
        });

        it('should return a 400 when both block height and sort key query params are provided', async () => {
          // block height before the interactions were created
          const validBlockHeight = 1;
          const exampleSortKey = 'example-sort-key';

          const { status } = await axios.get(
            `/v1/contract/${id}?blockHeight=${validBlockHeight}&sortKey=${exampleSortKey}`,
          );
          expect(status).to.equal(400);
        });

        it('should return contract state evaluated up to a given block height', async () => {
          const { height: previousBlockHeight } =
            await arweave.blocks.getCurrent();
          // mine a block height to ensure the contract is evaluated at previous one
          await arweave.api.get('mine');
          const { status, data } = await axios.get(
            `/v1/contract/${id}?blockHeight=${previousBlockHeight}`,
          );
          const { contractTxId, state, evaluationOptions, sortKey } = data;
          expect(status).to.equal(200);
          expect(contractTxId).to.equal(id);
          expect(evaluationOptions).not.to.be.undefined;
          expect(state).not.to.be.undefined;
          expect(sortKey).not.be.undefined;
          expect(sortKey.split(',')[0]).to.equal(
            `${previousBlockHeight}`.padStart(12, '0'),
          );
        });
        it('should return contract state evaluated up to a given sort key', async () => {
          const knownSortKey = contractInteractions[0].sortKey;
          // mine a block height to ensure the contract is evaluated at previous one
          await arweave.api.get('mine');
          const { status, data } = await axios.get(
            `/v1/contract/${id}?sortKey=${knownSortKey}`,
          );
          const { contractTxId, state, evaluationOptions, sortKey } = data;
          expect(status).to.equal(200);
          expect(contractTxId).to.equal(id);
          expect(evaluationOptions).not.to.be.undefined;
          expect(state).not.to.be.undefined;
          expect(sortKey).not.be.undefined;
          expect(sortKey).to.equal(knownSortKey);
        });
      });
      describe('/:contractTxId/price', () => {
        it('should not evaluate blocklisted contracts', async () => {
          const blocklistedContractTxId = process.env.BLOCKLISTED_CONTRACTS;
          const { status, data } = await axios.get(
            `/v1/contract/${blocklistedContractTxId}/price`,
          );
          expect(status).to.equal(403);
          expect(data.message).to.equal('Contract is blocklisted.');
        });

        it('should properly handle price interaction inputs', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/price?qty=100`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, result, evaluationOptions } = data;
          expect(contractTxId).to.equal(id);
          expect(evaluationOptions).not.to.be.undefined;
          expect(result).to.include.keys(['price']);
          expect(result.price).to.equal(100);
        });
      });

      describe('/:contractTxId/interactions', () => {
        it('should not evaluate blocklisted contracts', async () => {
          const blocklistedContractTxId = process.env.BLOCKLISTED_CONTRACTS;
          const { status, data } = await axios.get(
            `/v1/contract/${blocklistedContractTxId}/interactions`,
          );
          expect(status).to.equal(403);
          expect(data.message).to.equal('Contract is blocklisted.');
        });

        it('should return the contract interactions when no query params are provided', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey } = data;
          expect(contractTxId).to.equal(id);
          expect(sortKey).not.be.undefined;
          expect(interactions).to.deep.equal(contractInteractions);
        });

        it('should filter out poorly formatted interactions', async () => {
          // deploy the manual constructed interaction
          const badInteractionTx = await arweave.createTransaction(
            {
              data: Math.random().toString().slice(-4),
            },
            walletJWK,
          );
          badInteractionTx.addTag('App-Name', 'SmartWeaveAction');
          badInteractionTx.addTag('Contract', id);
          badInteractionTx.addTag(
            'input',
            JSON.stringify({ function: 'evolve', value: 'bad-interaction' }),
          );

          await arweave.transactions.sign(badInteractionTx, walletJWK);
          await arweave.transactions.post(badInteractionTx);

          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey } = data;
          expect(contractTxId).to.equal(id);
          expect(sortKey).not.be.undefined;
          expect(Object.keys(interactions)).not.to.contain(badInteractionTx.id);
        });

        it('should only return interactions up to a provided block height', async () => {
          // block height before the interactions were created
          const previousInteractionHeight = 1;

          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions?blockHeight=${previousInteractionHeight}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey } = data;
          expect(contractTxId).to.equal(id);
          expect(sortKey).not.be.undefined;
          expect(interactions).to.deep.equal([]);
        });

        it('should only return interactions up to a provided sort key height', async () => {
          const knownSortKey = contractInteractions[0].sortKey;
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions?sortKey=${knownSortKey}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey } = data;
          expect(contractTxId).to.equal(id);
          expect(sortKey).to.equal(knownSortKey);
          expect(interactions).to.deep.equal([contractInteractions[0]]);
        });

        it('should return the first page of contract interactions when page and page size are provided', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions?page=1&pageSize=1`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey, pages } = data;
          expect(sortKey).to.not.be.undefined;
          expect(pages).to.deep.equal({
            page: 1,
            pageSize: 1,
            totalPages: 1,
            totalItems: contractInteractions.length,
            hasNextPage: false,
          });
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal([contractInteractions[0]]);
        });

        it('should return an empty array of contract interactions when page is greater than the total number of pages', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions?page=2&pageSize=1`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey, pages } = data;
          expect(sortKey).to.not.be.undefined;
          expect(pages).to.deep.equal({
            page: 2,
            pageSize: 1,
            totalPages: 1,
            totalItems: contractInteractions.length,
            hasNextPage: false,
          });
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal([]);
        });
        it('should return a bad request error when invalid page size is provided', async () => {
          const { status } = await axios.get(
            `/v1/contract/${id}/interactions?page=1&pageSize=-1`,
          );
          expect(status).to.equal(400);
        });
        it('should return a bad request error when invalid page is provided', async () => {
          const { status } = await axios.get(
            `/v1/contract/${id}/interactions?page=-1`,
          );
          expect(status).to.equal(400);
        });
      });

      describe('/:contractTxId/interactions/:address', () => {
        it('should return the contract interactions for the provided address', async () => {
          const { status, data } = await axios.get(
            `/v1/contract/${id}/interactions/${walletAddress}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contractTxId, interactions, sortKey } = data;
          expect(contractTxId).to.equal(id);
          expect(sortKey).not.be.undefined;
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
          it('should not evaluate blocklisted contracts', async () => {
            const blocklistedContractTxId = process.env.BLOCKLISTED_CONTRACTS;
            const { status, data } = await axios.get(
              `/v1/contract/${blocklistedContractTxId}/${field}`,
            );
            expect(status).to.equal(403);
            expect(data.message).to.equal('Contract is blocklisted.');
          });

          it(`should return the correct state value for ${field}`, async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/${field}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).not.be.undefined;
            expect(data[field]).to.not.be.undefined; // we haven't created any interactions
          });

          it(`should return the correct state value for ${field} up to a given block height`, async () => {
            const previousBlockHeight = 1;
            const { status, data } = await axios.get(
              `/v1/contract/${id}/${field}?blockHeight=${previousBlockHeight}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).not.be.undefined;
            expect(data[field]).to.not.be.undefined; // we haven't created any interactions
          });

          it(`should return the correct state value for ${field} up to a given block height`, async () => {
            const knownSortKey = contractInteractions[0].sortKey;
            const { status, data } = await axios.get(
              `/v1/contract/${id}/${field}?sortKey=${knownSortKey}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).to.equal(knownSortKey);
            expect(data[field]).to.not.be.undefined; // we haven't created any interactions
          });
        }

        it('should return a 404 for an invalid field', async () => {
          const { status } = await axios.get(
            `/v1/contract/${id}/invalid-field`,
          );
          expect(status).to.equal(404);
        });

        describe('/records', () => {
          it('should return all records if no filter provided', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).not.be.undefined;
            expect(Object.keys(data['records'])).to.have.length(2);
          });

          it('should return records that have contractTxId matching the query filter', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records?contractTxId=${process.env.DEPLOYED_ANT_CONTRACT_TX_ID}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).not.be.undefined;
            expect(Object.keys(data['records'])).to.have.length(1);
          });

          it('should return empty records if the contractTxId does not match any record object', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records?contractTxId=not-a-real-tx-id`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).not.be.undefined;
            expect(Object.keys(data['records'])).to.have.length(0);
          });

          it(`should return the correct state value for record up to a given block height`, async () => {
            const knownSortKey = contractInteractions[0].sortKey;
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records?sortKey=${knownSortKey}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(sortKey).to.equal(knownSortKey);
            expect(Object.keys(data['records'])).to.have.length(2);
          });
        });

        describe('/records/:name', () => {
          it('should return the owner of record name when available', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records/example`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, owner, record, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(record).to.deep.equal({
              contractTxId: process.env.DEPLOYED_ANT_CONTRACT_TX_ID,
            });
            expect(sortKey).not.be.undefined;
            expect(owner).to.not.be.undefined;
            expect(owner).to.equal(walletAddress);
          });

          it('should not return the owner of a record name if the contractTxId does not exist on the record', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records/no-owner`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, owner, record, sortKey } = data;
            expect(contractTxId).to.equal(id);
            expect(record).to.not.be.undefined;
            expect(sortKey).not.be.undefined;
            expect(owner).to.be.undefined;
          });

          it(`should return the correct state value for record up to a given sort key`, async () => {
            const knownSortKey = contractInteractions[0].sortKey;
            const { status, data } = await axios.get(
              `/v1/contract/${id}/records/example?sortKey=${knownSortKey}`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contractTxId, sortKey, record, owner } = data;
            expect(contractTxId).to.equal(id);
            expect(record).to.deep.equal({
              contractTxId: process.env.DEPLOYED_ANT_CONTRACT_TX_ID,
            });
            expect(sortKey).not.be.undefined;
            expect(owner).to.not.be.undefined;
            expect(owner).to.equal(walletAddress);
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
            const {
              contractTxId,
              reserved,
              details,
              sortKey,
              evaluationOptions,
            } = data;
            expect(contractTxId).to.equal(id);
            expect(reserved).to.be.true;
            expect(details).to.not.be.undefined;
            expect(sortKey).to.not.be.undefined;
            expect(evaluationOptions).to.not.be.undefined;
          });

          it('should returns false when a contract is not reserved', async () => {
            const { status, data } = await axios.get(
              `/v1/contract/${id}/reserved/non-reserved-name`,
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const {
              contractTxId,
              reserved,
              details,
              sortKey,
              evaluationOptions,
            } = data;
            expect(contractTxId).to.equal(id);
            expect(reserved).to.be.false;
            expect(details).to.be.undefined;
            expect(sortKey).to.not.be.undefined;
            expect(evaluationOptions).to.not.be.undefined;
          });
        });
      });
    });

    describe('/wallet', () => {
      describe('/:address/contracts', () => {
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

      describe('/:address/contracts/:contractTxId', () => {
        it('should not evaluate blocklisted contracts', async () => {
          const blocklistedContractTxId = process.env.BLOCKLISTED_CONTRACTS;
          const { status, data } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${blocklistedContractTxId}`,
          );
          expect(status).to.equal(403);
          expect(data.message).to.equal('Contract is blocklisted.');
        });

        it('should return the the first page wallets contract interactions by default, with default page size of 100', async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contractTxId, interactions, sortKey, pages } = data;
          expect(address).to.equal(walletAddress);
          expect(sortKey).to.not.be.undefined;
          expect(pages).to.deep.equal({
            page: 1,
            pageSize: 100,
            totalPages: 1,
            totalItems: contractInteractions.length,
            hasNextPage: false,
          });
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal(contractInteractions);
        });
        it('should return the first page of interactions when page and page size are provided', async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}?page=1&pageSize=1`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contractTxId, interactions, sortKey, pages } = data;
          expect(address).to.equal(walletAddress);
          expect(sortKey).to.not.be.undefined;
          expect(pages).to.deep.equal({
            page: 1,
            pageSize: 1,
            totalPages: 1,
            totalItems: contractInteractions.length,
            hasNextPage: false,
          });
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal([contractInteractions[0]]);
        });
        it('should return the second page of interactions when page and page size are provided', async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}?page=2&pageSize=1`,
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contractTxId, interactions, sortKey, pages } = data;
          expect(address).to.equal(walletAddress);
          expect(sortKey).to.not.be.undefined;
          expect(pages).to.deep.equal({
            page: 2,
            pageSize: 1,
            totalPages: 1,
            totalItems: contractInteractions.length,
            hasNextPage: false,
          });
          expect(contractTxId).to.equal(id);
          expect(interactions).to.deep.equal([]);
        });
        it('should return a bad request error when invalid page size is provided', async () => {
          const { status } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}?page=1&pageSize=-1`,
          );
          expect(status).to.equal(400);
        });
        it('should return a bad request error when invalid page is provided', async () => {
          const { status } = await axios.get(
            `/v1/wallet/${walletAddress}/contract/${id}?page=0`,
          );
          expect(status).to.equal(400);
        });
      });
    });
  });
});
