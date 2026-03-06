# Architecture — assessment-image-storage-service

## 1. Purpose and Scope

This service owns a single bounded context: **Static File Storage**. It receives product image
binaries, writes them to a Docker volume, and serves them back over HTTP. It has no knowledge
of products, customers, or any business domain — it is a file storage service namespaced by
`productId`.

Core capabilities:

- **Upload** an image for a product (multipart/form-data) and return the generated image ID.
- **Serve** an image binary by product ID and image ID (public, immutably cached GET).
- **List** all image IDs under a product ID.
- **Delete** a single image by product ID and image ID.
- **Delete all** images under a product ID (directory removal).
- **Health check** — verify the Docker volume is mounted and writable.

What this service does **not** do:

- Persist metadata to a database — the calling service owns that responsibility.
- Validate that a product ID exists in any catalogue.
- Connect to external object storage (S3, GCS, etc.).

---

## 2. Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS 10 + Fastify adapter |
| Language | TypeScript 5 (strict mode, ES2022) |
| File upload | `@fastify/multipart` |
| Image validation | `sharp` (validates real image binary via metadata probe) |
| Storage backend | `node:fs/promises` on a Docker volume |
| DTO validation | Zod 4 |
| Env validation | Joi |
| API docs | `@nestjs/swagger` (OpenAPI 3.0) |
| Security | `@fastify/helmet`, `@fastify/cors`, API key guard |
| Testing | Jest 29 + `@swc/jest` |
| Containerisation | Docker multi-stage (Alpine), named Docker volume |

No database driver, no ORM, no S3 SDK.

---

## 3. Hexagonal Architecture

The project follows hexagonal (ports-and-adapters) architecture with four layers. The domain is
the centre; all outer layers depend inward, never the reverse.

```
                    +------------------------------------------+
  Driving Adapters  |                                          |  Driven Adapters
  (HTTP via         |        APPLICATION CORE                  |  (Filesystem via
   Fastify)  ------>|  Domain Layer + Application Layer        |----> node:fs/promises)
                    |                                          |
                    +------------------------------------------+
                            ^                   ^
                       Input Port          Output Port
                      (Use Case)         (StoragePort)
```

### 3.1 Layer Map

```
src/
  domain/                         @domain/*
    image/
      image-file.value-object.ts  Value object + Zod schemas + ImageFileDto
      errors/
        image-not-found.error.ts
        image-too-large.error.ts
        unsupported-mime-type.error.ts
        images-limit-exceeded.error.ts
        storage-operation-failed.error.ts
        index.ts                  ImageError union type

  application/                    @application/*
    image/
      ports/
        storage.port.ts           StoragePort interface (output port)
      use-cases/
        upload-image.use-case.ts
        serve-image.use-case.ts
        list-images.use-case.ts
        delete-image.use-case.ts
        delete-product-images.use-case.ts

  infrastructure/                 @infrastructure/*
    storage/
      filesystem.adapter.ts       Implements StoragePort via node:fs/promises
    config/
      env-validation.ts           Joi schema for environment variables

  presentation/                   @presentation/*
    image/
      image.controller.ts         HTTP driving adapter
      pipes/
        image-validation.pipe.ts  Multipart file extraction and MIME validation
    health/
      health.controller.ts        Volume write probe endpoint
    helpers/
      result-to-response.helper.ts  Result<T,E> to HTTP exception mapping

  modules/
    storage.module.ts             Wires FilesystemAdapter as StoragePort
    image.module.ts               Wires all use cases + ImageController
    health.module.ts              Wires HealthController

  shared/                         @shared/*
    result.ts                     Result<T,E> type + railway combinators
    di-tokens.ts                  DI_TOKENS.STORAGE_PORT
    constants/
      image.constants.ts          ALLOWED_MIME_TYPES, DEFAULT_MAX_FILE_SIZE_MB, etc.
    errors/
      infrastructure.error.ts
    filters/
      http-exception.filter.ts    Global exception filter
    guards/
      api-key.guard.ts            x-api-key header guard
      public.decorator.ts         @Public() route decorator
    interceptors/
      logging.interceptor.ts      Request/response logging

  app.module.ts
  main.ts                         Fastify bootstrap + multipart + Swagger + Helmet + CORS
```

### 3.2 Dependency Rules

```
presentation  -->  application  -->  domain
infrastructure  -->  domain  (implements domain interfaces)
shared  <--  all layers may import from shared
```

Path aliases (`@domain/*`, `@application/*`, etc.) are enforced at compile time via
`tsconfig.json`. Relative imports across layer boundaries are prohibited.

---

## 4. Storage Model

All image files live on a single Docker named volume mounted at `VOLUME_MOUNT_PATH`
(default: `/data/images`).

### Directory layout on the volume

```
/data/images/
  +-- {productId}/              Created on first upload for that product
      +-- {imageId-1}.jpg
      +-- {imageId-2}.png
      +-- {imageId-3}.webp
```

### Path computation

```
absolute path = join(VOLUME_MOUNT_PATH, productId, imageId + "." + extension)
relative path = productId + "/" + imageId + "." + extension
```

The `storagePath` field in the upload response is the relative path. The calling service
persists this to reconstruct the serve URL. The image ID is generated at upload time (UUID v4)
so the path is known before the file is written.

### StoragePort interface

The application layer never touches `node:fs` directly. It depends only on `StoragePort`,
defined in `src/application/image/ports/storage.port.ts`:

```typescript
export interface StoragePort {
  write(relativePath: string, buffer: Buffer): Promise<Result<void, StorageOperationFailedError>>;
  read(relativePath: string):                  Promise<Result<Buffer, StorageOperationFailedError>>;
  delete(relativePath: string):                Promise<Result<void, StorageOperationFailedError>>;
  deleteDirectory(directoryPath: string):      Promise<Result<void, StorageOperationFailedError>>;
  exists(relativePath: string):                Promise<Result<boolean, StorageOperationFailedError>>;
  list(directoryPath: string):                 Promise<Result<string[], StorageOperationFailedError>>;
}
```

`FilesystemAdapter` is the sole implementation. It is injected at the composition root
(`StorageModule`) via the `DI_TOKENS.STORAGE_PORT` injection token. In tests, the port is
replaced with either a `jest.fn()` mock (unit tests) or a `FilesystemAdapter(tmpDir)`
(integration/E2E tests).

---

## 5. Railway Oriented Programming (ROP)

All operations that can fail return `Result<T, E>` — never `throw`. Exceptions are reserved
for truly unrecoverable faults (framework panics).

### Result type

```typescript
type Success<T> = { readonly ok: true;  readonly value: T };
type Failure<E> = { readonly ok: false; readonly error: E };
type Result<T, E = Error> = Success<T> | Failure<E>;

const ok  = <T>(value: T): Success<T> => ({ ok: true,  value });
const err = <E>(error: E): Failure<E> => ({ ok: false, error });
```

### Available combinators (`@shared/result.ts`)

| Combinator | Purpose |
|---|---|
| `isOk(r)` / `isErr(r)` | Type guards |
| `map(result, fn)` | Transform the success value; pass failures through |
| `flatMap(result, fn)` | Chain a step that itself returns a Result |
| `mapErr(result, fn)` | Transform the error type; pass successes through |
| `asyncFlatMap(result, fn)` | Async version of flatMap |
| `fromThrowable(fn, onThrow)` | Wrap a throwing function into a Result |
| `fromPromise(promise, onReject)` | Wrap a rejecting Promise into a Result |

`fromThrowable` and `fromPromise` are used exclusively at infrastructure boundaries
(inside `FilesystemAdapter`) to convert `node:fs` exceptions into typed
`StorageOperationFailedError` values.

### Where each concern lives

| Concern | Layer | Mechanism |
|---|---|---|
| Error propagation | Domain / Application | Return `Result<T, E>` |
| Wrapping infra exceptions | Infrastructure | `fromPromise` / `fromThrowable` |
| Unwrapping Results | Presentation | `unwrapResult()` — converts `Failure` to HTTP exceptions |

---

## 6. Domain Layer

### ImageFile value object

`ImageFile` is a request-scoped value object — there is no database entity. It is created
by `UploadImageUseCase`, validated, and discarded after the response is sent.

`ImageFile.create()` performs domain validation and returns `Result`:
- Returns `err(UnsupportedMimeTypeError)` if the MIME type is not in `ALLOWED_MIME_TYPES`.
- Returns `err(ImageTooLargeError)` if `sizeBytes` exceeds `maxBytes`.
- Returns `ok(ImageFile)` on success.

The constructor is `private` — creation only via the static factory.

### Domain errors

Each failure is a typed value object in `src/domain/image/errors/`. The discriminated union
`ImageError` covers all expected failures:

| Error class | Code | Trigger |
|---|---|---|
| `ImageNotFoundError` | `IMAGE_NOT_FOUND` | File absent from the volume |
| `ImageTooLargeError` | `IMAGE_TOO_LARGE` | `sizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024` |
| `UnsupportedMimeTypeError` | `UNSUPPORTED_MIME_TYPE` | MIME type not in allowed list |
| `ImagesLimitExceededError` | `IMAGES_LIMIT_EXCEEDED` | Product directory already at max count |
| `StorageOperationFailedError` | `STORAGE_OPERATION_FAILED` | `node:fs` operation failed |

---

## 7. Application Layer — Use Cases

Each use case is an `@Injectable()` class with a single `execute()` method that returns
`Promise<Result<OutputDto, ImageError>>`.

### UploadImageUseCase

```
1. Validate MIME type            -> err(UnsupportedMimeTypeError)
2. Validate file size            -> err(ImageTooLargeError)
3. List files in product dir     -> check count <= MAX_IMAGES_PER_PRODUCT
                                 -> err(ImagesLimitExceededError)
4. Validate binary with sharp    -> err(StorageOperationFailedError)
5. Generate UUID, compute path   -> {productId}/{imageId}.{ext}
6. Create ImageFile value object -> domain validation
7. Write to Docker volume        -> err(StorageOperationFailedError)
8. Return ok(ImageFileDto)
```

### ServeImageUseCase

```
1. List product directory        -> find file matching {imageId}.*
2. Not found?                    -> err(ImageNotFoundError)
3. Read file binary              -> err(StorageOperationFailedError)
4. Derive MIME type from ext     -> return ok({ buffer, mimeType })
```

### ListImagesUseCase

```
1. List product directory        -> storage.list(productId)
2. Strip extension from each filename
3. Return ok(imageIds[])
```

### DeleteImageUseCase

```
1. List product directory        -> find file matching {imageId}.*
2. Not found?                    -> err(ImageNotFoundError)
3. Delete file                   -> err(StorageOperationFailedError)
4. Return ok(undefined)
```

### DeleteProductImagesUseCase

```
1. storage.deleteDirectory(productId)  -> remove entire product directory
2. Return ok(undefined)
```

---

## 8. Infrastructure Layer

### FilesystemAdapter

`FilesystemAdapter` implements `StoragePort` using `node:fs/promises`. Every method:

1. Resolves the absolute path: `path.join(rootPath, relativePath)`.
2. Wraps the `node:fs/promises` call in a `try/catch`. On failure, logs the error and
   returns `err(new StorageOperationFailedError(...))`.
3. `write()` creates parent directories with `mkdir({ recursive: true })` before writing.
4. `list()` and `exists()` treat "not found" as a normal (non-error) case and return
   `ok([])` / `ok(false)` respectively.

The constructor accepts `rootPath` (injected from `VOLUME_MOUNT_PATH`) so the E2E test
suite can override it with a temporary directory.

---

## 9. Presentation Layer

### ImageController

Routes all requests through the appropriate use case. Uses `ParseUUIDPipe` on every UUID
path parameter — non-UUID values are rejected with 400 before reaching any business logic.

The `@UseGuards(ApiKeyGuard)` decorator is applied at class level. Individual routes that
should be publicly accessible are decorated with `@Public()`.

Multipart file extraction is done manually inside the `upload()` handler by calling
`this.imageValidationPipe.transform(request)`. NestJS `@Req()` does not execute pipe
arguments — the pipe must be invoked explicitly.

### ImageValidationPipe

Extracts the file from the Fastify multipart request via `request.file()`, validates the
MIME type against `ALLOWED_MIME_TYPES`, buffers the stream, and returns a typed
`{ buffer, originalName, mimeType, sizeBytes }` object. Throws `BadRequestException` for
missing or unparseable files, and `UnsupportedMediaTypeException` for disallowed MIME types.

### Error-to-HTTP mapping (`unwrapResult`)

| Domain Error | HTTP Status |
|---|---|
| `ImageNotFoundError` | 404 Not Found |
| `ImageTooLargeError` | 413 Payload Too Large |
| `UnsupportedMimeTypeError` | 415 Unsupported Media Type |
| `ImagesLimitExceededError` | 409 Conflict |
| `StorageOperationFailedError` | 502 Bad Gateway |
| Unknown / unexpected | 500 Internal Server Error |

---

## 10. API Routes

Global prefix: `{API_PREFIX}/{NODE_ENV}/{API_VERSION}` (default: `/api/development/v1`).

| Method | Path | Auth | Status codes |
|---|---|---|---|
| `POST` | `/products/:productId/images` | API key | 201, 400, 401, 409, 413, 415, 502 |
| `GET` | `/products/:productId/images` | Public | 200, 502 |
| `GET` | `/products/:productId/images/:imageId` | Public | 200, 404, 502 |
| `DELETE` | `/products/:productId/images/:imageId` | API key | 204, 401, 404, 502 |
| `DELETE` | `/products/:productId/images` | API key | 204, 401, 502 |
| `GET` | `/health` | Public | 200 |

The serve endpoint (`GET /products/:productId/images/:imageId`) responds with the raw binary
and the following headers:

```
Content-Type:        image/jpeg | image/png | image/webp | image/gif
Cache-Control:       public, max-age=31536000, immutable
ETag:                "{imageId}"
Content-Disposition: inline
```

---

## 11. Security

### API Key Guard (`ApiKeyGuard`)

Applied globally at the controller level. Behaviour:

1. If `API_KEY_ENABLED=false` (default), all requests pass regardless of headers.
2. If the route is decorated with `@Public()`, all requests pass.
3. Otherwise, the `x-api-key` header is compared against `API_KEY`. A missing or incorrect
   key returns `401 Unauthorized`.

### Helmet

`@fastify/helmet` is registered globally with `contentSecurityPolicy: false` (disabled to
allow Swagger UI to function).

### CORS

`@fastify/cors` is conditionally registered when `CORS_ENABLED=true` (default). Allowed
methods: `GET, POST, DELETE, OPTIONS`. Origin is configurable via `CORS_ORIGIN` (default: `*`).

---

## 12. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment; included in the URL prefix |
| `PORT` | `3001` | HTTP listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `debug` | Logger verbosity |
| `API_PREFIX` | `/api` | Route prefix segment |
| `API_VERSION` | `v1` | Route version segment |
| `API_KEY_ENABLED` | `false` | Enable/disable the x-api-key guard |
| `API_KEY` | — | Expected API key value (required when guard is enabled) |
| `ENABLE_SWAGGER` | `true` | Mount Swagger UI at `/docs` |
| `ENABLE_HEALTH_CHECK` | `true` | Register the health check endpoint |
| `APP_NAME` | `assessment-image-storage-service` | Swagger document title |
| `APP_DESCRIPTION` | — | Swagger document description |
| `CORS_ENABLED` | `true` | Enable CORS |
| `CORS_ORIGIN` | `*` | Allowed origins (comma-separated for multiple) |
| `VOLUME_MOUNT_PATH` | `/data/images` | Absolute path to the Docker volume mount point |
| `MAX_FILE_SIZE_MB` | `10` | Upload size limit in megabytes |
| `MAX_IMAGES_PER_PRODUCT` | `20` | Maximum images per product directory |

No database variables. No S3/cloud storage variables. The only storage configuration is
`VOLUME_MOUNT_PATH`.

---

## 13. Test Architecture

### Test matrix

| Suite | Runner config | Scope |
|---|---|---|
| Unit | `test/unit/jest.config.mjs` | All use cases, controller, pipe, guards, filters, interceptors, adapter (mocked fs), helpers |
| Integration | `test/integration/jest.config.mjs` | `FilesystemAdapter` against a real `tmpdir` |
| E2E | `test/e2e/jest-e2e.json` | Full NestJS app (Fastify) with `overrideProvider` for storage |

### Unit tests

Use cases are tested against a `makeStoragePortMock()` (all methods are `jest.fn()`). There
is no disk I/O in unit tests. `sharp` is module-mocked with `jest.mock('sharp', ...)`.

`ImageValidationPipe` is tested by constructing a mock `FastifyRequest` with a `file` jest
function. `ImageController` is tested by mocking the pipe instance and all five use cases.

### E2E tests

`Test.createTestingModule({ imports: [AppModule] })` bootstraps the full application.
The storage provider is overridden before compilation:

```typescript
.overrideProvider(DI_TOKENS.STORAGE_PORT)
.useFactory({ factory: () => new FilesystemAdapter(tmpRoot) })
```

This avoids `process.env` manipulation which does not work reliably with NestJS
`ConfigModule.forRoot` Joi defaults. A real temporary directory (`mkdtemp`) is used and
cleaned up in `afterAll`.

Real PNG buffers are generated via `sharp` for upload payloads. Multipart bodies are
constructed manually with a fixed boundary string for use with Fastify's `app.inject()`.

### Coverage thresholds (unit suite)

| Metric | Threshold | Achieved |
|---|---|---|
| Statements | 85% | 99.2% |
| Branches | 80% | 100% |
| Functions | 85% | 100% |
| Lines | 85% | 100% |

---

## 14. Key Design Decisions

**No database.** This service is a pure file proxy. The calling service persists the image
URL (`storagePath`) in its own database. This service can be deployed, scaled, and restarted
with zero database concerns.

**Docker volume as the sole storage backend.** Files are written directly to the filesystem
via `node:fs/promises`. The Docker volume ensures data persists across container lifecycle
events. The infrastructure layer is a single `FilesystemAdapter` class.

**StoragePort interface despite a single implementation.** The port decouples the application
layer from `node:fs` and enables trivial unit testing with a mock. It is not an abstraction
for future S3 support — if that need arises, a second adapter implements the same port without
touching application code.

**Value object instead of entity.** Without persistence, there is no identity lifecycle.
`ImageFile` validates invariants during the request and is discarded afterward.

**File existence as the source of truth.** `ServeImageUseCase` and `DeleteImageUseCase`
resolve files by scanning the product directory. `ListImagesUseCase` reads the directory to
enumerate IDs. There is no in-memory index.

**Image ID generated at upload time.** A UUID v4 is created before writing the file so the
storage path is known upfront. The caller receives this ID in the response and can construct
serve URLs deterministically.

**Immutable files.** Once uploaded, a file is never modified — only deleted and re-uploaded.
This enables aggressive `Cache-Control: public, max-age=31536000, immutable` headers on the
serve endpoint.

**Binary serving through the use case.** Rather than exposing the volume via
`@fastify/static`, the controller routes through the use case to enforce UUID format
validation, attach cache headers, and provide an extension point for future concerns
(access control, watermarking, on-the-fly resizing).

**Manual pipe invocation in `upload()`.** NestJS `@Req()` does not execute pipe arguments
the way `@Body()` or `@Param()` do — it passes the raw FastifyRequest. The
`ImageValidationPipe` is instantiated as a class property and called explicitly inside the
handler.

---

## 15. Inter-Service Interaction

```
Client               Catalogue Service           Image Storage Service
  |                        |                             |
  |-- POST /products/:id/images                          |
  |              (forward upload) ---------------------->|
  |                        |                    validate + write to volume
  |                        |<--- { id, storagePath } ----|
  |                  save storagePath                    |
  |<-- 201 { imageUrl } --|                             |
  |                        |                             |
  |-- GET /products/:id/images/:imageId (direct or CDN) >|
  |<-- image binary (volume, immutable cache) -----------|
```

The catalogue/domain service owns product and image metadata. This service owns only the
binary bytes on the Docker volume. The `storagePath` returned at upload time is the
contract between the two services.
