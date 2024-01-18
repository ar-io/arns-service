# arns-service

Koa microservice that facilities the ArNS Portal.

## Getting Started

Requirements:

- `nvm`
- `yarn`
- `docker`

### Running Locally

Starting the service:

- `nvm use`
- `yarn`
- `cp .env.sample .env` (and update values)
- `yarn start:dev`

You can check the service is running by running the command:

```shell
curl localhost:3000/healthcheck
{"timestamp":"2023-04-13T13:33:38.299Z","status":200,"message":"Hello world."}
```

### Docker

Build and run the latest image:

```shell
docker run -e GATEWAY_HOST=arweave.net -p 3000:3000 ghcr.io/ar-io/arns-service:latest
```

You can run on a different port by changing the `-e PORT=3000 -p 3000:3000` to `-e PORT=4000 -p 4000:4000`, for example, or specify a `.env` file with `--env-file` flag.

## Warp

The service leverages `warp-sdk` to retrieve, evaluate and cache contract state. To request a contract state, run:

```shell
curl localhost:3000/v1/contract/${CONTRACT_ID}
```

e.g.

```shell
curl localhost:3000/v1/contract/bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U
```

For more advanced features of Warp caching and state evaluation (e.g. [D.R.E nodes]), refer to the [Warp] documentation.

### SQLite

This service uses the `warp-contracts-sqlite` for storing contract state. The sqlite database is stored in the `./cache` directory. To clear the Warp cache, run:

```shell
rm -rf ./cache
```

### Evaluation Options

By default, the service will load `Contract-Manifest` tags for state evaluation.

### Syncing State

Similar to [D.R.E nodes], the service can be configured to sync state for a given contract. This is useful for contracts with large number of interactions that may take a long time to evaluate locally. To sync state from this service via [Warp], you can use `syncState()` with the `/v1/contract/${CONTRACT_ID}` endpoint:

```js
const contract = await warp
  .contract(CONTRACT_TX_ID)
  .setEvaluationOptions(evaluationOptions)
  .syncState(`https://api.arns.app/v1/contract/${CONTRACT_TX_ID}`);
```

## Configuration

The service can be configured using environment variables. The following environment variables are supported:

- `PORT`: the port on which the service should listen. Defaults to 3000 if not set.
- `GATEWAY_PORT`: the gateway port used to evaluate Smartcontract state.
- `GATEWAY_PROTOCOL`: the gateway protocol (`http` | `https`) to evaluate Smartcontract state.
- `GATEWAY_HOST`: the gateway host used to evaluate Smartcontract state (e.g `ar-io.dev` or `127.0.0.1` for arlocal).
- `GATEWAY_HOST`: the gateway used to evaluate Smartcontract state.
- `LOG_LEVEL`: the log level to display (using [Winston] log levels - e.g. `info`, `debug`)
- `LOG_FORMAT`: the log format to use when printing logs (e.g. `json`, `simple`)
- `PREFETCH_CONTRACTS`: boolean to enable/disable prefetching of contracts on startup. Defaults to `true`.
- `PREFETCH_CONTRACT_IDS`: comma separated list of contract IDs to prefetch on startup
- `ARNS_CONTRACT_TX_ID`: the ArNS contract transaction ID. Defaults to `bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U` and when `PREFETCH_CONTRACTS` is `true`, will be prefetched on startup.
- `BOOTSTRAP_CACHE`: loads warp cache from S3 on startup. Defaults to `false`.
- `BLOCKLISTED_CONTRACT_IDS`: comma separated list of contract IDs to block evaluation. These contracts will return `403` when requested.

You can `cp .env.sample .env` and modify them locally.

## Integration Tests

Integration tests are used to validate endpoints and response payloads. Then can be run locally via:

```shell
docker compose up arns-service -d --build
yarn test:integration:local
```

or entirely via docker compose:

```shell
yarn docker:integration
```

## Swagger

[Swagger] is used for endpoint documentation and testing. When running the service, you can load the Swagger UI in your browser at:

```shell
http://localhost:3000/api-docs
```

For production, the Swagger UI is available at:

```shell
https://api.arns.app/api-docs
```

## Contributions

- Build to interfaces
- Integration tests take precedent over unit tests
- Use [conventional commits] for commit messages
- Use [prettier] for code formatting
- Use [eslint] for linting
- Use [swagger] for API documentation

[Swagger]: https://swagger.io/
[conventional commits]: https://www.conventionalcommits.org/en/v1.0.0/
[prettier]: https://prettier.io/
[eslint]: https://eslint.org/
[Warp]: https://academy.warp.cc/docs/docs-intro
[D.R.E nodes]: https://academy.warp.cc/docs/dre/overview
