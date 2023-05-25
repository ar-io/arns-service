# pdns-service

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
- `yarn start:dev`

You can check the service is running by running the command:

```shell
curl localhost:3000/healthcheck
{"timestamp":"2023-04-13T13:33:38.299Z","status":200,"message":"Hello world."}
```

### Docker

Build and run the container:

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) . -t pdns-service
docker run -p 3000:3000 pdns-service
```

## Warp

The service leverages `warp-sdk` to retrieve, evaluate and cache contract state. To request a contract state, run:

```shell
curl localhost:3000/contract/CONTRACT_ID
```

e.g.

```shell
curl localhost:3000/contract/bLAgYxAdX2Ry-nt6aH2ixgvJXbpsEYm28NgJgyqfs-U
```

## Configuration

The service can be configured using environment variables. The following environment variables are supported:

`PORT`: The port on which the service should listen. Defaults to 3000 if not set.
`GATEWAY_HOST`: The gateway used to evaluate Smartcontract state.

## Integration Tests

Integration tests are used to validate endpoints and response payloads. Then can be run locally via:

```shell
yarn docker:run
yarn test:integration
```

or entirely via docker compose:

```shell
yarn docker:integration
```

## Contributing

- Build to interfaces
- Integration tests take precedent over unit tests
