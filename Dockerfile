ARG NODE_VERSION=18.17.0
ARG NODE_VERSION_SHORT=18

FROM node:${NODE_VERSION}-bullseye-slim AS builder

# Needed for some dev deps
RUN apt-get update && apt-get install -y git

# Build
WORKDIR /usr/src/app
COPY . .
RUN yarn && yarn build

# Extract dist
FROM gcr.io/distroless/nodejs${NODE_VERSION_SHORT}-debian11
WORKDIR /usr/src/app

# Add shell
COPY --from=busybox:1.35.0-uclibc /bin/sh /bin/sh
COPY --from=busybox:1.35.0-uclibc /bin/chown /bin/chown
COPY --from=busybox:1.35.0-uclibc /bin/chmod /bin/chmod
COPY --from=busybox:1.35.0-uclibc /bin/sleep /bin/sleep

# Copy build files
COPY --from=builder /usr/src/app .

# Setup port
EXPOSE 3000

# Add labels
LABEL org.opencontainers.image.title="ar.io - ArNS Service"

ENTRYPOINT [ "/bin/sh", "entrypoint.sh" ]
