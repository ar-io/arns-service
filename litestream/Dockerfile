# Start with a standard Ubuntu base image
FROM ubuntu:20.04 as builder

# Install curl and other necessary tools
RUN apt-get update && apt-get install -y curl

# Download and install ytt
RUN curl -L https://github.com/vmware-tanzu/carvel-ytt/releases/download/v0.44.1/ytt-linux-amd64 > /usr/local/bin/ytt \
    && chmod 755 /usr/local/bin/ytt

FROM litestream/litestream:latest

COPY --from=builder /usr/local/bin/ytt /usr/local/bin/ytt

COPY litestream.template.yaml .
COPY docker-entrypoint.sh .

RUN chmod 755 /docker-entrypoint.sh

ENTRYPOINT [ "./docker-entrypoint.sh" ]
