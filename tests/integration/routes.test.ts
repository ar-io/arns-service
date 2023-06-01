import { describe } from "mocha";
import { expect } from "chai";
import axiosPackage from "axios";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = process.env.PORT ?? 3000;
const serviceURL = `http://${HOST}:${+PORT}`;
const axios = axiosPackage.create({
  baseURL: serviceURL,
  validateStatus: () => true, // don't throw errors
});
describe("PDNS Service Integration tests", () => {
  let id: string | undefined;
  let wallet: string | undefined;
  before(() => {
    id = process.env.DEPLOYED_CONTRACT_TX_ID;
    wallet = process.env.PRIMARY_WALLET_ADDRESS;
    expect(id).to.not.be.undefined;
    expect(id!.length).to.equal(43);
  });

  describe("general routes", () => {
    it("should return 200 from healthcheck", async () => {
      const { status, data } = await axios.get(`/healthcheck`);
      expect(status).to.equal(200);
      expect(data).to.not.be.undefined;
    });

    it("should return 200 prometheus", async () => {
      const { status, data } = await axios.get(`/arns_metrics`);
      expect(status).to.equal(200);
      expect(data).to.not.be.undefined;
    });
  });

  describe("/v1", () => {
    describe("/contract", () => {
      describe("/:id", () => {
        // TODO: once write interactions are added, add more tests to validate the state values
        it("should return the contract state and id", async () => {
          const { status, data } = await axios.get(`/v1/contract/${id}`);
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contract, state } = data;
          expect(contract).to.equal(id);
          expect(state).to.include.keys([
            "balances",
            "owner",
            "name",
            "records",
            "ticker",
            "owner",
            "controller",
          ]);
          expect(state.owner).to.equal(wallet);
        });

        it("should return a 404 for an invalid id", async () => {
          const { status } = await axios.get(`/v1/contract/non-matching-regex`);
          expect(status).to.equal(404);
        });
      });

      describe("/:id/interactions", () => {
        // TODO: once write interactions are added, add additional tests that confirm the interactions are provided by this endpoint
        it("should return the contract interactions", async () => {
          const { status, data } = await axios.get(
            `/contract/${id}/interactions`
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contract, interactions } = data;
          expect(contract).to.equal(id);
          expect(interactions).to.deep.equal([]); // we haven't created any interactions
        });
      });

      describe("/:id/:field", () => {
        for (const field of [
          "balances",
          "owner",
          "name",
          "records",
          "ticker",
          "owner",
          "controller",
        ]) {
          // TODO: once write interactions are added, add more tests to validate the state is what's expected
          it(`should return the correct state value for ${field}`, async () => {
            const { status, data } = await axios.get(
              `${serviceURL}/contract/${id}/${field}`
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { contract } = data;
            expect(contract).to.equal(id);
            expect(data[field]).to.not.be.undefined; // we haven't created any interactions
          });
        }

        it("should return a 404 for an invalid field", async () => {
          const { status } = await axios.get(
            `${serviceURL}/contract/${id}/invalid-field`
          );
          expect(status).to.equal(404);
        });
      });

      describe("/:id", () => {
        // TODO: once write interactions are added, add more tests to validate the state is what's expected
        it("should return the contract state and id", async () => {
          const { status, data } = await axios.get(`/v1/contract/${id}`);
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { contract, state } = data;
          expect(contract).to.equal(id);
          expect(state).to.include.keys([
            "balances",
            "owner",
            "name",
            "records",
            "ticker",
            "owner",
            "controller",
          ]);
          expect(state.owner).to.equal(wallet);
        });

        it("should return a 404 for an invalid id", async () => {
          const { status } = await axios.get(`/v1/contract/non-matching-regex`);
          expect(status).to.equal(404);
        });
      });
    });

    describe("/wallet", () => {
      describe("/:address/contracts", () => {
        it("should return the full list of deployed contracts", async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${wallet}/contracts`
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contractIds } = data;
          expect(address).to.equal(wallet);
          expect(contractIds).to.not.be.undefined;
          expect(contractIds).to.deep.equal([id]);
        });

        describe("?type=", () => {
          it("should return the list of deployed contracts matching specific ant type", async () => {
            const { status, data } = await axios.get(
              `${serviceURL}/wallet/${wallet}/contracts?type=ant`
            );
            expect(status).to.equal(200);
            expect(data).to.not.be.undefined;
            const { address, contractIds } = data;
            expect(address).to.equal(wallet);
            expect(contractIds).to.not.be.undefined;
            expect(contractIds).to.deep.equal([]); // our initial contract doesn't have an '@' record
          });

          it("should return return a 400 when an invalid type is provided", async () => {
            const { status, data } = await axios.get(
              `${serviceURL}/wallet/${wallet}/contracts?type=invalid`
            );
            expect(status).to.equal(400);
            expect(data).to.contain("Invalid type.");
          });
        });

        it("should return a 404 for an invalid wallet address", async () => {
          const { status } = await axios.get(
            `/v1/wallet/non-matching-regex/contracts`
          );
          expect(status).to.equal(404);
        });
      });

      describe("/:address/contracts/:id/interactions", () => {
        it("should return the all the wallets contract interactions", async () => {
          const { status, data } = await axios.get(
            `/v1/wallet/${wallet}/contract/${id}`
          );
          expect(status).to.equal(200);
          expect(data).to.not.be.undefined;
          const { address, contractId, interactions } = data;
          expect(address).to.equal(wallet);
          expect(contractId).to.equal(id);
          expect(interactions).to.deep.equal({}); // we haven't created any interactions
        });
      });
    });
  });
});
