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

Build and run the container:

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) --build-arg NODE_VERSION_SHORT=$(cat .nvmrc |cut -c2-3) . -t arns-service
docker run -e PORT=3000 -p 3000:3000 arns-service
```

You can run on a different port by changing the `-e PORT=3000 -p 3000:3000` to `-e PORT=4000 -p 4000:4000`, for example.

## Warp

The service leverages `warp-sdk` to retrieve, evaluate and cache contract state. To request a contract state, run:

```shell
curl localhost:3000/v1/contract/${CONTRACT_ID}
```

e.g.

```shell
curl localhost:3000/v1/contract/bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U
```

For more advanced features of Warp caching and state evaluation (e.g. D.R.E nodes), refer to the [Warp] documentation.

### LMDB

This service uses the `warp-contracts-lmdb` for storing contract state. The LMDB is stored in the `./cache` directory. To clear the LMDB, run:

```shell
rm -rf ./cache
```

### Evaluation Options

By default, the service will load `Contract-Manifest` tags for state evaluation.

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
