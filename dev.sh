#!/usr/bin/env bash
# Local preview: http://localhost:8080  (Ctrl+C to stop)
cd "$(dirname "$0")"
( sleep 1; open "http://localhost:8080" ) >/dev/null 2>&1 &
exec python3 -m http.server 8080
