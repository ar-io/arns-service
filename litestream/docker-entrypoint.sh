#!/usr/bin/env sh
set -e

# Update env vars
ytt --data-values-env TVAL -f /litestream.template.yaml >  /litestream.yml

# restore if needed
echo "Restoring database from backup..."
/usr/local/bin/litestream restore -if-db-not-exists -parallelism 10 -config /litestream.yml $TVAL_LOCAL_DB_PATH/state.db
/usr/local/bin/litestream restore -if-db-not-exists -parallelism 10 -config /litestream.yml $TVAL_LOCAL_DB_PATH/contract.db

if [[ -n "$WAIT_TIME_SECONDS" ]]; then
    # Sleep for the number of seconds specified in WAIT_TIME_SECONDS
    echo "Waiting for $WAIT_TIME_SECONDS seconds before starting replication..."
    sleep $WAIT_TIME_SECONDS
fi

echo "Starting Litestream for continuous replication..."
/usr/local/bin/litestream replicate -config /litestream.yml
