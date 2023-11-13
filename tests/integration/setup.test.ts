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
import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import * as fs from 'fs';
import path from 'path';
import { LoggerFactory, WarpFactory } from 'warp-contracts';
import { DeployPlugin } from 'warp-contracts-plugin-deploy';

const GATEWAY_PORT = process.env.GATEWAY_PORT ?? 1984;
const GATEWAY_HOST = process.env.GATEWAY_HOST ?? '127.0.0.1';
const GATEWAY_PROTOCOL = process.env.GATEWAY_PROTOCOL ?? 'http';
// Arweave
export const arweave = new Arweave({
  protocol: GATEWAY_PROTOCOL,
  port: GATEWAY_PORT,
  host: GATEWAY_HOST,
});
// Warp
LoggerFactory.INST.logLevel('fatal');
export const warp = WarpFactory.forLocal(+GATEWAY_PORT, arweave).use(
  new DeployPlugin(),
);

// start arlocal
export async function mochaGlobalSetup() {
  console.log('Setting up Warp, Arlocal and Arweave clients!');
  // create directories used for tests
  createDirectories();

  // create a wallet and add some funds
  const { wallet, address } = await createLocalWallet(arweave);

  // Used in tests
  process.env.PRIMARY_WALLET_ADDRESS = address;

  const contractSrcJs = fs.readFileSync(
    path.join(__dirname, './arlocal/index.js'),
    'utf8',
  );

  const initState = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, './arlocal/initial-state.json'),
      'utf8',
    ),
  );

  // deploy example any contract
  const { contractTxId: antContractTxId } = await warp.deploy(
    {
      wallet,
      initState: JSON.stringify({
        ...initState,
        ticker: 'ANT-TEST',
        owner: address,
        controller: address,
        records: {
          '@': {
            transactionId: 'a-fake-transaction-id',
          },
        },
        balances: {
          [address]: 1,
        },
      }),
      src: contractSrcJs,
    },
    true, // disable bundling
  );

  // deploy registry contract to arlocal
  const { contractTxId } = await warp.deploy(
    {
      wallet,
      initState: JSON.stringify({
        ...initState,
        ticker: 'ArNS-REGISTRY-TEST',
        owner: address,
        controller: address,
        records: {
          example: {
            contractTxId: antContractTxId,
          },
          'no-owner': 'no-owner',
        },
        balances: {
          [address]: 1,
        },
        auctions: {},
        reserved: {
          'reserved-name': {
            target: 'a-fake-transaction-id',
          },
        },
      }),
      src: contractSrcJs,
      evaluationManifest: {
        evaluationOptions: {
          // used for testing query params
          throwOnInternalWriteError: true,
        },
      },
    },
    true, // disable bundling
  );

  // set in the environment
  process.env.DEPLOYED_REGISTRY_CONTRACT_TX_ID = contractTxId;
  process.env.DEPLOYED_ANT_CONTRACT_TX_ID = antContractTxId;
  console.log(
    `Successfully setup ArLocal and deployed contracts.\nRegistry: ${contractTxId}\nANT: ${antContractTxId}`,
  );
}

export function mochaGlobalTeardown() {
  removeDirectories();
  console.log('Test finished!');
}

function removeDirectories() {
  ['./wallets', './contracts'].forEach((dir) => {
    if (fs.existsSync(path.join(__dirname, dir))) {
      fs.rmSync(path.join(__dirname, dir), { recursive: true });
    }
  });
}

function createDirectories() {
  ['./wallets', './contracts'].forEach((dir) => {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      fs.mkdirSync(path.join(__dirname, dir));
    }
  });
}

export async function createLocalWallet(
  arweave: Arweave,
  amount = 10_000_000_000_000,
): Promise<{ wallet: JWKInterface; address: string }> {
  // ~~ Generate wallet and add funds ~~
  const wallet = await arweave.wallets.generate();
  const address = await arweave.wallets.jwkToAddress(wallet);
  // mint some tokens
  await arweave.api.get(`/mint/${address}/${amount}`);
  // save it to local directory
  fs.writeFileSync(
    path.join(__dirname, `./wallets/${address}.json`),
    JSON.stringify(wallet),
  );
  return {
    wallet,
    address,
  };
}
