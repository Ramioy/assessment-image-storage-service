#!/usr/bin/env bash
# Manage both development and production Docker environments at once.
#
# Usage:
#   ./all.sh          # start both
#   ./all.sh start    # start both
#   ./all.sh down     # stop and remove both
#   ./all.sh restart  # down + start both
#   ./all.sh ps       # show running containers for both
#   ./all.sh logs     # follow logs for both (interleaved)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CMD="${1:-start}"

case "$CMD" in
  start)
    bash "$SCRIPT_DIR/dev.sh" start
    bash "$SCRIPT_DIR/prod.sh" start
    ;;

  down)
    bash "$SCRIPT_DIR/dev.sh" down
    bash "$SCRIPT_DIR/prod.sh" down
    ;;

  restart)
    bash "$SCRIPT_DIR/dev.sh" restart
    bash "$SCRIPT_DIR/prod.sh" restart
    ;;

  ps)
    echo "=== development ==="
    bash "$SCRIPT_DIR/dev.sh" ps
    echo ""
    echo "=== production ==="
    bash "$SCRIPT_DIR/prod.sh" ps
    ;;

  logs)
    ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
    docker compose \
      -f "$ROOT_DIR/environment/development/docker-compose.yaml" \
      -f "$ROOT_DIR/environment/production/docker-compose.yaml" \
      logs -f
    ;;

  *)
    echo "Unknown command: $CMD"
    echo "Commands: start | down | restart | ps | logs"
    exit 1
    ;;
esac
