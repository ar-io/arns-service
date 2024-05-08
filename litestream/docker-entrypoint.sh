#!/usr/bin/env sh
set -e

# Update env vars
ytt --data-values-env TVAL -f /litestream.template.yaml >  /litestream.yml

# restore if needed
echo "Restoring database from backup..."
/usr/local/bin/litestream restore -config /litestream.yml $TVAL_LOCAL_DB_PATH/state.db
/usr/local/bin/litestream restore -config /litestream.yml $TVAL_LOCAL_DB_PATH/contract.db

echo "Starting Litestream for continuous replication..."
/usr/local/bin/litestream replicate -config /litestream.yml
