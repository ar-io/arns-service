# arns-service

Koa microservice that facilities the PDNS Portal.

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

Build and run the container:

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) --build-arg NODE_VERSION_SHORT=$(cat .nvmrc |cut -c2-3) . -t arns-service
docker run -p 3000:3000 arns-service
```

## Warp

The service leverages `warp-sdk` to retrieve, evaluate and cache contract state. To request a contract state, run:

```shell
curl localhost:3000/v1/contract/CONTRACT_ID
```

e.g.

```shell
curl localhost:3000/v1/contract/bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U
```

### Evaluatuion Options

By default, the service will load `Contract-Manifest` tags for state evaluation. Query params can be provided if you wish to evaluate state using more restrictive tags. If an invalid combination of evaluation options are provided via query params, a 400 response will be returned.

Examples:

1. Valid evaluation option

   ```shell
   curl localhost:3000/v1/contract/bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U?internalWrites=false
   ```

   - Will evaluate the contact with `internalWrites` set to `false`.

2. Invalid evaluation param provided
   A query param that is looser than the contract's own evaluation options:

   ```shell
   curl http://localhost:3000/contract/GfrHPxXyfuxNNdGvzHl_5HFX711jZsG3OE8qmG-UqlY?waitForConfirmation=false
   ```

   - Returns the following response:

   ```
   Failed to fetch contract: GfrHPxXyfuxNNdGvzHl_5HFX711jZsG3OE8qmG-UqlY. Option {waitForConfirmation} differs. EvaluationOptions: [false], manifest: [true]. Use contract.setEvaluationOptions({waitForConfirmation: true}) to evaluate contract state.
   ```

The list of all evaluation options and their priority provided by [Warp](warp.cc) can be found [here](https://academy.warp.cc/docs/sdk/advanced/evaluation-options)

## Configuration

The service can be configured using environment variables. The following environment variables are supported:

- `PORT`: the port on which the service should listen. Defaults to 3000 if not set.
- `GATEWAY_PORT`: the gateway port used to evaluate Smartcontract state.
- `GATEWAY_PROTOCOL`: the gateway protocol (`http` | `https`) to evaluate Smartcontract state.
- `GATEWAY_HOST`: the gateway host used to evaluate Smartcontract state (e.g `ar-io.dev` or `127.0.0.1` for arlocal).
- `GATEWAY_HOST`: the gateway used to evaluate Smartcontract state.
- `LOG_LEVEL`: the log level to display (using [Winston] log levels - e.g. `info`, `debug`)
- `LOG_FORMAT`: the log format to use when printing logs (e.g. `json`, `simple`)

You can `cp .env.sample .env` and modify them locally.

## Integration Tests

Integration tests are used to validate endpoints and response payloads. Then can be run locally via:

```shell
docker compose up arns-service arlocal --build
yarn test:integration
```

or entirely via docker compose:

```shell
yarn docker:integration
```

## Swagger

TODO

## Contributions

- Build to interfaces
- Integration tests take precedent over unit tests
