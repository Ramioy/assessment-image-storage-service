#!/usr/bin/env bash
# Health check — public endpoint, no API key required.
#
# Verifies the Docker volume is mounted and writable by probing the
# storage layer. Returns status "ok" or "degraded".
#
# Usage:
#   ./health.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

echo "GET $BASE_URL/health"
curl -s "$BASE_URL/health" | _pretty
