#!/usr/bin/env bash
# Start the development Docker environment.
#
# - Copies environment/development/example.env -> environment/development/.env (if .env is missing)
# - Brings up all containers defined in environment/development/docker-compose.yaml
#
# Usage:
#   ./dev.sh            # start (detached)
#   ./dev.sh down       # stop and remove containers
#   ./dev.sh logs       # follow container logs
#   ./dev.sh restart    # down + start
#   ./dev.sh ps         # show running containers

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_DIR="$ROOT_DIR/environment/development"
COMPOSE_FILE="$ENV_DIR/docker-compose.yaml"
EXAMPLE_ENV="$ENV_DIR/example.env"
TARGET_ENV="$ENV_DIR/.env"

_ensure_env() {
  if [ ! -f "$TARGET_ENV" ]; then
    echo "[dev] .env not found — copying from example.env"
    cp "$EXAMPLE_ENV" "$TARGET_ENV"
    echo "[dev] Created: $TARGET_ENV"
    echo "[dev] Review and update values before proceeding if needed."
  else
    echo "[dev] Using existing: $TARGET_ENV"
  fi
}

CMD="${1:-start}"

case "$CMD" in
  start)
    _ensure_env
    echo "[dev] Starting containers..."
    docker compose -f "$COMPOSE_FILE" --env-file "$TARGET_ENV" up --build -d
    PORT="$(grep '^PORT=' "$TARGET_ENV" | cut -d= -f2 || echo 3001)"
    echo "[dev] Containers started. API: http://localhost:${PORT}/api/development/v1"
    echo "[dev] Docs: http://localhost:${PORT}/docs"
    ;;

  down)
    echo "[dev] Stopping containers..."
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
