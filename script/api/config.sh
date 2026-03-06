#!/usr/bin/env bash
# Shared configuration for all API scripts.
# Source this file: source "$(dirname "$0")/config.sh"

NODE_ENV="${NODE_ENV:-development}"
BASE_URL="${BASE_URL:-http://localhost:3001/api/${NODE_ENV}/v1}"
API_KEY="${API_KEY:-your-development-secret-key-change-in-production}"

# Set API_KEY_ENABLED=true to send the x-api-key header on guarded routes
API_KEY_ENABLED="${API_KEY_ENABLED:-false}"

# _curl_json — curl with JSON Content-Type (used for non-multipart requests)
_curl_json() {
  if [ "$API_KEY_ENABLED" = "true" ]; then
    curl -s -H "Content-Type: application/json" -H "x-api-key: $API_KEY" "$@"
  else
    curl -s -H "Content-Type: application/json" "$@"
  fi
}

# _curl_auth — curl without a preset Content-Type (for multipart uploads where
# curl sets the boundary automatically via -F)
_curl_auth() {
  if [ "$API_KEY_ENABLED" = "true" ]; then
    curl -s -H "x-api-key: $API_KEY" "$@"
  else
    curl -s "$@"
  fi
}

# _pretty — pretty-print JSON if jq is available, otherwise pass through
_pretty() {
  if command -v jq &>/dev/null; then
    jq .
  else
    cat
  fi
}
