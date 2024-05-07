#!/usr/bin/env sh
set -e

# Update env vars
ytt --data-values-env TVAL -f /litestream.template.yaml >  /litestream.yml

/usr/local/bin/litestream replicate -config /litestream.yml
