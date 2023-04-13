# pdns-service
Koa microservice that facilities the PDNS Portal.
___

## Getting Started

Requirements:
- `nvm`
- `yarn`
- `docker`

### Locally
Starting the service:

- `nvm use`
- `yarn`
- `yarn start:dev`

You can check the service is running by running the command:

```shell
$ curl localhost:3000/healthcheck
{"timestamp":"2023-04-13T13:33:38.299Z","status":200,"message":"Hello world."}
```

### Docker

To build the container,

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) . pdns-service
docker run -p 3000:3000 pdns-service
```

___

## Configuration
The service can be configured using environment variables. The following environment variables are supported:

`PORT`: The port on which the service should listen. Defaults to 3000 if not set.

## Contributing

- Build to interfaces
- Integration tests take precedent over unit tests

