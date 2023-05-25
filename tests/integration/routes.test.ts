import { describe } from "mocha";
import { expect } from "chai";
import axios from "axios";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = process.env.PORT ?? 3000;
describe("Routes", () => {
  const serviceURL = `http://${HOST}:${+PORT}`;
  it("should return 200 from healthcheck", async () => {
    const { status, data } = await axios.get(`${serviceURL}/healthcheck`);
    expect(status).to.equal(200);
    expect(data).to.not.be.undefined;
  });
});
