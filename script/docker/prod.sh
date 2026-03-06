#!/usr/bin/env bash
# Start the production Docker environment.
#
# - Copies environment/production/example.env -> environment/production/.env (if .env is missing)
# - Brings up all containers defined in environment/production/docker-compose.yaml
#
# IMPORTANT: Review and fill in real secrets in environment/production/.env before running.
#            At minimum: API_KEY, CORS_ORIGIN.
#
# Usage:
#   ./prod.sh            # start (detached)
#   ./prod.sh down       # stop and remove containers
#   ./prod.sh logs       # follow container logs
#   ./prod.sh restart    # down + start
#   ./prod.sh ps         # show running containers

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_DIR="$ROOT_DIR/environment/production"
COMPOSE_FILE="$ENV_DIR/docker-compose.yaml"
EXAMPLE_ENV="$ENV_DIR/example.env"
TARGET_ENV="$ENV_DIR/.env"

_ensure_env() {
  if [ ! -f "$TARGET_ENV" ]; then
    echo "[prod] .env not found — copying from example.env"
    cp "$EXAMPLE_ENV" "$TARGET_ENV"
    echo "[prod] Created: $TARGET_ENV"
    echo ""
    echo "[prod] WARNING: Update all placeholder values in $TARGET_ENV before starting:"
    echo "         API_KEY, CORS_ORIGIN, VOLUME_MOUNT_PATH (if different from /data/images)"
    echo ""
    read -r -p "[prod] Press Enter to continue or Ctrl+C to abort and edit the file first..."
  else
    echo "[prod] Using existing: $TARGET_ENV"
  fi
}

CMD="${1:-start}"

case "$CMD" in
  start)
    _ensure_env
    echo "[prod] Building and starting containers..."
    docker compose -f "$COMPOSE_FILE" --env-file "$TARGET_ENV" up --build -d
    PORT="$(grep '^PORT=' "$TARGET_ENV" | cut -d= -f2 || echo 3001)"
    echo "[prod] Containers started. API: http://localhost:${PORT}/api/production/v1"
    ;;

  down)
    echo "[prod] Stopping containers..."
    docker compose -f "$COMPOSE_FILE" down
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f
    ;;

  restart)
    bash "$0" down
    bash "$0" start
    ;;

  ps)
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  *)
    echo "Unknown command: $CMD"
    echo "Commands: start | down | logs | restart | ps"
    exit 1
    ;;
esac
