ARG  NODE_VERSION

FROM node:${NODE_VERSION}-bullseye-slim AS builder

# Needed for some dev deps
RUN apt-get update && apt-get install -y git

# Build
WORKDIR /usr/src/app
COPY . .
RUN yarn && yarn build

# Extract dist
FROM gcr.io/distroless/nodejs:16
WORKDIR /usr/src/app

# Add shell
COPY --from=busybox:1.35.0-uclibc /bin/sh /bin/sh
COPY --from=busybox:1.35.0-uclibc /bin/addgroup /bin/addgroup
COPY --from=busybox:1.35.0-uclibc /bin/adduser /bin/adduser
COPY --from=busybox:1.35.0-uclibc /bin/chown /bin/chown

# Create user
RUN addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node
RUN chown -R node ./
USER node

# Copy build files
COPY --from=builder --chown=node /usr/src/app .

LABEL org.opencontainers.image.title="ar.io - PDNS Service"

EXPOSE 3000
CMD ["./dist/app.js"]
