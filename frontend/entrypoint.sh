#!/bin/sh
if [ -n "$BACKEND_URL" ]; then
    sed -i "s|const API_URL = '/api'|const API_URL = '$BACKEND_URL/api'|g" /usr/share/nginx/html/index.html
fi
exec "$@"
