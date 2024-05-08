#!/bin/sh

# Check and set permissions if necessary
if [ -d "/usr/src/app/cache" ]; then
  chmod -R 755 /usr/src/app/cache
fi

if [[ -n "$WAIT_TIME_SECONDS" ]]; then
    # Sleep for the number of seconds specified in WAIT_TIME_SECONDS
    echo "Waiting for $WAIT_TIME_SECONDS seconds before starting the service..."
    sleep $WAIT_TIME_SECONDS
fi

# run the app
exec /nodejs/bin/node /usr/src/app/dist/app.js
