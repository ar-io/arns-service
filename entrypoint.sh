#!/bin/sh
# Check and set permissions if necessary
if [ -d "/usr/src/app/cache" ]; then
  chown -R node:node /usr/src/app/cache
  chmod -R 755 /usr/src/app/cache
fi

# run the app
exec /nodejs/bin/node /usr/src/app/dist/app.js
