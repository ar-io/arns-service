#!/usr/bin/env sh
set -e

# Update env vars
ytt --data-values-env TVAL -f /litestream.template.yaml >  /litestream.yml

# only restore if environment variable is set
if [[ "$RESTORE_FROM_BACKUP" = "true" ]]; then
    echo "Restoring from backup..."
    if ! /usr/local/bin/litestream restore -if-db-not-exists -if-replica-exists -parallelism 10 -config /litestream.yml $TVAL_LOCAL_DB_PATH/state.db; then
     echo "Failed to restore state.db"
    fi
    if ! /usr/local/bin/litestream restore -if-db-not-exists -if-replica-exists -parallelism 10 -config /litestream.yml $TVAL_LOCAL_DB_PATH/contract.db; then
        echo "Failed to restore contract.db"
    fi
else
    echo "No RESTORE_FROM_BACKUP environment variable set, skipping restore..."
fi

if [[ -n "$WAIT_TIME_SECONDS" ]]; then
    # Sleep for the number of seconds specified in WAIT_TIME_SECONDS, this is useful if we are prefetching contracts
    echo "Waiting for $WAIT_TIME_SECONDS seconds before starting replication..."
    sleep $WAIT_TIME_SECONDS
fi

echo "Starting Litestream for continuous replication..."
/usr/local/bin/litestream replicate -config /litestream.yml
