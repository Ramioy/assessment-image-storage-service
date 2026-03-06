# Assessment Image Storage Service

A file-system-backed image storage microservice built with [NestJS](https://nestjs.com/) and [Fastify](https://fastify.dev/), following **Hexagonal Architecture** (Ports & Adapters). It exposes a RESTful API for uploading, serving, listing, and deleting product image files, stored on a local Docker volume.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Docker](#docker)
- [Scripts](#scripts)
- [Design Decisions](#design-decisions)
- [License](#license)
- [Author](#author)

---

## Architecture

The codebase is organised into four distinct layers with dependencies flowing strictly inward:

```
Presentation  -->  Application  -->  Domain
                       |
                Infrastructure
```

| Layer | Location | Responsibility |
|---|---|---|
| **Domain** | `src/domain/` | Pure business entities, Value Objects, Zod schemas, domain errors. Zero external dependencies. |
| **Application** | `src/application/` | Use cases that orchestrate domain logic. Defines driving (input) and driven (output) port interfaces. |
| **Infrastructure** | `src/infrastructure/` | Filesystem storage adapter, sharp image validation, env config. |
| **Presentation** | `src/presentation/` | HTTP controllers, multipart parsing, request/response mapping. |
| **Shared** | `src/shared/` | Cross-cutting concerns: `Result<T,E>` type, base entity, DI tokens, guards, filters, interceptors. |

Full architectural documentation is available in [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md).

---

## Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS 10 with Fastify adapter |
| Language | TypeScript 5 (strict mode) |
| Image processing | sharp |
| Multipart | @fastify/multipart |
| Validation | Zod (domain/DTOs) / Joi (environment variables) |
| API Docs | Swagger / OpenAPI via `@nestjs/swagger` |
| Security | Helmet, CORS, API key guard |
| Testing | Jest with SWC for compilation |
| Containerisation | Docker (multi-stage build, Alpine) |

---

## Prerequisites

- Node.js >= 20
- npm >= 9
- Docker (for containerised runs)

---

## Getting Started

**1. Clone the repository**

```bash
git clone <repository-url>
cd assessment-image-storage-service
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create your `.env` files under the `environment/` directory:

```
environment/
  development/.env
  production/.env
```

Copy the provided examples as a starting point:

```bash
cp environment/development/example.env environment/development/.env
cp environment/production/example.env  environment/production/.env
```

See [Environment Variables](#environment-variables) for the full list of supported keys.

**4. Start the application**

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server starts on the host and port defined by `HOST` and `PORT` (defaults to `0.0.0.0:3001`).

Routes are prefixed with `{API_PREFIX}/{NODE_ENV}/{API_VERSION}` — e.g. `/api/development/v1`.

---

## Environment Variables

All variables are validated at startup via Joi. The application will fail to boot if required variables are missing or invalid.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `PORT` | No | `3001` | HTTP listen port |
| `HOST` | No | `0.0.0.0` | HTTP listen address |
| `LOG_LEVEL` | No | `debug` | `error`, `warn`, `info`, `debug`, `verbose`, `silly` |
| `API_PREFIX` | No | `/api` | Global route prefix |
| `API_VERSION` | No | `v1` | API version segment |
| `API_KEY_ENABLED` | No | `false` | Require `x-api-key` header on protected routes |
| `API_KEY` | **Yes** | *(dev default)* | Expected API key value |
| `APP_NAME` | No | `assessment-image-storage-service` | Swagger document title |
| `APP_DESCRIPTION` | No | *(empty)* | Swagger document description |
| `ENABLE_SWAGGER` | No | `true` | Serve Swagger UI at `/docs` |
| `ENABLE_HEALTH_CHECK` | No | `true` | Enable `/health` endpoint |
| `VOLUME_MOUNT_PATH` | No | `/data/images` | Absolute path to the image storage directory |
| `MAX_FILE_SIZE_MB` | No | `10` | Maximum upload size in megabytes |
| `MAX_IMAGES_PER_PRODUCT` | No | `20` | Maximum images allowed per product |
| `CORS_ENABLED` | No | `true` | Enable CORS |
| `CORS_ORIGIN` | No | `*` | Comma-separated allowed origins (`*` allows all) |

---

## API Reference

All routes are prefixed with `{API_PREFIX}/{NODE_ENV}/{API_VERSION}` (e.g. `/api/development/v1`).

When Swagger is enabled, interactive documentation is available at `/docs`.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check — probes storage volume for writability |

### Images

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/products/:productId/images` | Protected | Upload an image file (`multipart/form-data`, field: `file`) |
| `GET` | `/products/:productId/images` | Public | List image IDs for a product |
| `GET` | `/products/:productId/images/:imageId` | Public | Serve an image binary (streams the file with correct `Content-Type`) |
| `DELETE` | `/products/:productId/images/:imageId` | Protected | Delete a single image |
| `DELETE` | `/products/:productId/images` | Protected | Delete all images for a product |

Protected routes require the `x-api-key` header when `API_KEY_ENABLED=true`.

Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

---

## Project Structure

```
src/
  domain/
    image/
      errors/            Typed domain error classes (ImageNotFoundError, etc.)
      image-file.value-object.ts   ImageFile value object with sharp validation
      image.repository.ts          StoragePort interface (output port)
  application/
    image/
      use-cases/         One class per use case (upload, list, serve, delete, delete-all)
  infrastructure/
    config/              Joi env validation schema
    storage/             FilesystemAdapter — implements StoragePort using node:fs
  presentation/
    health/              HealthController
    image/               ImageController, multipart pipe, result-to-response helper
  modules/               NestJS feature modules (DI wiring)
  shared/
    constants/           Image constants (MIME types, size limits)
    filters/             Global HTTP exception filter
    guards/              API key guard and @Public() decorator
    interceptors/        Request/response logging interceptor
    errors/              InfrastructureError wrapper
    result.ts            Result<T,E> type with railway combinators
    di-tokens.ts         Centralised dependency injection tokens
  app.module.ts          Root application module
  main.ts                Bootstrap and server configuration

environment/
  development/           example.env + .env (git-ignored)
  production/            example.env + .env (git-ignored)

doc/
  ARCHITECTURE.md        Full architectural reference
  api/
    service-schema.json  OpenAPI 3.0.3 schema

script/
  api/                   Bash helpers for every API endpoint
  docker/                Docker Compose lifecycle scripts

test/
  unit/                  Unit tests mirroring src/ structure
  helpers/               Shared test factories
```

---

## Testing

Tests use Jest with SWC for fast compilation. The suite covers domain entities, value objects, use cases, the filesystem adapter, controllers, guards, filters, and interceptors.

```bash
# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage report
npm run test:cov

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

Test files live under `test/unit/` mirroring the `src/` directory structure. Use cases are tested with mocked storage ports; the filesystem adapter is tested with mocked `node:fs/promises`.

---

## Docker

The project ships a multi-stage Dockerfile optimised for production:

- **Build stage** -- installs all dependencies (including dev), compiles TypeScript with SWC
- **Production stage** -- installs only production dependencies, rebuilds `sharp` native binaries, runs as a non-root user (`appuser`)

Images are stored in a named Docker volume mounted at `VOLUME_MOUNT_PATH`.

### Manual build and run

```bash
# Build the image
docker build -t assessment-image-storage-service .

# Run the container
docker run -p 3001:3001 \
  -e API_KEY=your-secret-key \
  -v image-data:/data/images \
  assessment-image-storage-service
```

---

## Scripts

### Docker lifecycle

| Script | Description |
|---|---|
| `script/docker/dev.sh` | Manage the development Docker environment (start / down / logs / restart / ps) |
| `script/docker/prod.sh` | Manage the production Docker environment |
| `script/docker/all.sh` | Manage both environments at once |

Each script copies `example.env` to `.env` on first run if the file is missing.

```bash
# Start development environment
./script/docker/dev.sh start

# Start production environment
./script/docker/prod.sh start

# Start both
./script/docker/all.sh start

# Stop both
./script/docker/all.sh down

# Follow logs from both
./script/docker/all.sh logs
```

### API helpers

| Script | Description |
|---|---|
| `script/api/config.sh` | Shared config (BASE_URL, API_KEY, curl helpers) — sourced by others |
| `script/api/health.sh` | GET /health |
| `script/api/images.sh` | Full image API: upload, list, serve, delete, delete-all |

```bash
# Health check
./script/api/health.sh

# Upload an image
./script/api/images.sh upload <productId> ./photo.jpg

# List images for a product
./script/api/images.sh list <productId>

# Download an image (auto-detects extension)
./script/api/images.sh serve <productId> <imageId>

# Delete a single image
./script/api/images.sh delete <productId> <imageId>

# Delete all images for a product
./script/api/images.sh delete-all <productId>
```

Override defaults via environment variables:

```bash
BASE_URL=http://localhost:3002/api/production/v1 \
API_KEY_ENABLED=true \
API_KEY=your-secret-key \
./script/api/images.sh upload prod-123 ./banner.png
```

---

## Design Decisions

**Hexagonal Architecture** -- Business logic is decoupled from framework and infrastructure concerns. The `StoragePort` interface lives in the domain layer; the `FilesystemAdapter` in infrastructure implements it. Swapping storage backends (S3, GCS) requires only a new adapter.

**Result type over exceptions** -- Use cases return `Result<T, DomainError>` instead of throwing. Error paths are explicit and composable via `map`, `flatMap`, and `asyncFlatMap` railway combinators. The presentation layer converts results to HTTP responses through `resultToResponse()`.

**sharp for image validation** -- Uploaded files are piped through sharp to read image metadata before persisting. This rejects corrupt files, enforces MIME type consistency, and provides width/height data without a full decode.

**Filesystem-backed storage** -- Images are stored as flat files under a per-product directory (`{VOLUME_MOUNT_PATH}/{productId}/{imageId}`). The Docker volume provides persistence across container restarts. The design is intentionally simple — no database, no object store dependency.

**Zod for domain validation, Joi for env validation** -- Zod schemas are co-located with domain entities and reused for API response shapes. Joi handles environment variable validation at startup via `@nestjs/config`.

**Fastify over Express** -- Fastify is used as the HTTP adapter for lower overhead, native async support, and built-in multipart handling via `@fastify/multipart`.

**SWC for test compilation** -- Jest uses `@swc/jest` instead of `ts-jest` for significantly faster test execution.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

## Author

**Yoimar Moreno Bertel**

- Email: Yoimar.mb@outlook.com
- LinkedIn: [linkedin.com/in/yoimar-mb](https://www.linkedin.com/in/yoimar-mb/)
