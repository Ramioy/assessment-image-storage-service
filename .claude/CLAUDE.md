# CLAUDE.md — Project Rules for Claude Code

This is the single source of truth for every rule Claude Code must follow when generating,
editing, or refactoring code in this project. It covers architecture, code style, error
handling, testing, and the work process. When in doubt, re-read the relevant section here
before writing any code.

---

## 1. Language & Tooling

- TypeScript only — no `.js` files inside `src/`.
- Target: ES2022, module: commonjs.
- Decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`).
- Strict mode is ON — all strict sub-flags active (`noImplicitAny`, `strictNullChecks`,
  `strictBindCallApply`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`).
- Never use `@ts-ignore` or `as any` to silence type errors — fix the root cause.
- Never use `!` non-null assertion without a guard comment explaining why it is safe.
- Never use `require()` — use ESM-style `import`.
- `skipLibCheck: true` — do not add `// @ts-nocheck` to source files because a `.d.ts` fails.

---

## 2. Architecture — Hexagonal (Clean Architecture)

The domain is the center. Everything else adapts to it, never the reverse.

```
                        ┌─────────────────────────────┐
  Driving Adapters      │                             │     Driven Adapters
  (HTTP, CLI, WS)  ───> │      APPLICATION CORE       │ ───> (DB, Email, Queue,
                        │  Domain + Application Layer  │       External APIs)
                        │                             │
                        └─────────────────────────────┘
                               ^            ^
                           Input Port   Output Port
                           (Use Case)  (Repository Interface)
```

### 2.1 Layer Structure & Path Aliases

```
src/
├── domain/           → @domain/*      Entities, Value Objects, Domain Events,
│                                      Repository interfaces, Domain Services
├── application/      → @application/* Use Cases, DTOs, Application Services, Ports
├── infrastructure/   → @infrastructure/* TypeORM repos, external clients,
│                                         messaging, config
├── presentation/     → @presentation/* Controllers, route handlers,
│                                       request/response mapping
└── shared/           → @shared/*      BaseEntity, Zod base schemas, Result type,
                                       utilities, constants
```

### 2.2 Layer Dependency Rules

```
presentation  -->  application  -->  domain
infrastructure  -->  domain  (implements domain interfaces)
shared  <--  all layers may import from shared
```

- `@domain/*` must NEVER import from `@application/*`, `@infrastructure/*`, or
  `@presentation/*`.
- `@application/*` must NEVER import from `@infrastructure/*` or `@presentation/*`.
- Cross-layer wiring belongs in a composition root (e.g., a NestJS module file).
- Always use `@layer/*` path aliases — never use relative imports (`../../`) across
  layer boundaries.
- The domain core must have zero knowledge of frameworks, ORMs, HTTP, or any I/O
  mechanism. Never let a framework decorator (`@Injectable`, `@Column`, `@Get`) bleed
  into the domain layer.
- Dependency inversion is mandatory: application code depends on port interfaces;
  infrastructure provides concrete implementations injected at the composition root.

### 2.3 Layer Responsibilities

| Layer          | What lives here                                                    |
| -------------- | ------------------------------------------------------------------ |
| Domain         | Entities, Value Objects, Domain Events, Repository interfaces (ports), Domain Services |
| Application    | Use Cases, Input/Output ports, Application Services, DTOs (Zod)    |
| Infrastructure | TypeORM repos (adapters), external clients, messaging, config      |
| Presentation   | Controllers, route handlers, request/response mapping              |
| Shared         | BaseEntity, Zod base schemas, Result type, utilities, constants    |

---

## 3. Railway Oriented Programming (ROP)

All operations that can fail return `Result<T, E>` instead of throwing exceptions.
Exceptions are reserved for truly unexpected, unrecoverable faults. This is the only
error propagation mechanism allowed in the domain and application layers.

### 3.1 The Result Type

The canonical implementation lives in `@shared/result.ts`:

```typescript
export type Success<T> = { readonly ok: true;  readonly value: T };
export type Failure<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Success<T> | Failure<E>;

export const ok  = <T>(value: T): Success<T> => ({ ok: true,  value });
export const err = <E>(error: E): Failure<E> => ({ ok: false, error });
```

Available combinators (also in `@shared/result.ts`):

- `isOk(r)` / `isErr(r)` — type guards.
- `map(result, fn)` — transform the success value; pass failures through.
- `flatMap(result, fn)` — chain a step that itself returns a Result (core ROP combinator).
- `mapErr(result, fn)` — transform the error type; pass successes through.
- `asyncFlatMap(result, fn)` — async version of flatMap for use-case chains.
- `fromThrowable(fn, onThrow)` — wraps a throwing function into a Result.
  Use ONLY at infrastructure boundaries.
- `fromPromise(promise, onReject)` — wraps a rejecting Promise into a Result.
  Use ONLY at infrastructure boundaries.

### 3.2 Domain Errors

Every possible business failure is a typed value object in
`@domain/<feature>/errors/`. Never use plain `Error` or string literals.

Naming convention: `<EntityName><FailureReason>Error`.

```typescript
// src/domain/customer/errors/customer-already-exists.error.ts
export class CustomerAlreadyExistsError {
  readonly code = 'CUSTOMER_ALREADY_EXISTS' as const;
  readonly message: string;

  constructor(readonly email: string) {
    this.message = `A customer with email "${email}" already exists.`;
  }
}
```

Group all errors for a feature into a discriminated union:

```typescript
// src/domain/customer/errors/index.ts
export type CustomerError =
  | CustomerAlreadyExistsError
  | CustomerNotFoundError
  | InvalidDocumentNumberError;
```

### 3.3 Use Case Return Signature

Every use case must return `Promise<Result<OutputDto, DomainErrorUnion>>`.
No exceptions, no `void` returns for operations that can fail.

### 3.4 Chaining Steps

Prefer `flatMap` / `asyncFlatMap` to keep chains flat instead of nesting
`if (!result.ok)` guards. For long chains, explicit guards are acceptable when the
combinator form reduces readability. Consistency within a file matters more than strict
combinator use.

### 3.5 Where Each Concern Lives

| Concern                | Where                          | How                                               |
| ---------------------- | ------------------------------ | ------------------------------------------------- |
| Error propagation      | Domain / Application           | Return `Result<T, E>` — never `throw`             |
| Wrapping infra exceptions | Infrastructure only          | `fromPromise` / `fromThrowable`                   |
| Unwrapping Results     | Presentation only              | Convert `Failure` to HTTP status codes             |
| Entity validation      | Domain entity static factory   | Return `Result` — never throw from constructors    |

### 3.6 Anti-Patterns

- Never swallow a failure (`result.value!` non-null assertion).
- Never mix `throw` and `Result` in the same layer.
- Never use `try/catch` in domain/application layers for business logic.
- Never return `null` instead of a typed failure — use `Result` with explicit error context.
- Never re-wrap a `Failure` in a new error type (loses context) — return it as-is.

---

## 4. Entities, Zod Schemas & DTOs

### 4.1 BaseEntity & Three-Schema Pattern

Every TypeORM entity must extend `BaseEntity` from `@shared/base.entity` and export
exactly three Zod schemas plus their inferred DTO types:

```typescript
export const productCategorySchema = baseSchema.extend({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
});

export const createProductCategorySchema = productCategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

export type ProductCategoryDto       = z.infer<typeof productCategorySchema>;
export type CreateProductCategoryDto = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryDto = z.infer<typeof updateProductCategorySchema>;
```

Rules:

- `entitySchema` — full shape, used for API responses.
- `createEntitySchema` — omits `id`, `createdAt`, `updatedAt` (server-generated).
- `updateEntitySchema` — `.partial()` of create (PATCH semantics).
- All DTOs are inferred from Zod — never write separate `interface`/`class` DTOs.
- Validate at the presentation layer using the Zod schema before passing data inward.
- Zod schemas are the single source of truth for shape validation — never add
  `class-validator` or manual validation alongside an existing Zod schema.

### 4.2 Domain Entity Rules

- Entities must contain behaviour, not be plain data bags (no Anemic Domain Model).
- Constructors do not contain business logic — use static factory methods that return
  `Result`:

```typescript
export class Customer extends BaseEntity {
  private constructor(props: CustomerProps) { super(props.id); }

  static create(dto: CreateCustomerDto): Result<Customer, ValidationError> { ... }
}
```

- Wrap meaningful primitives in Value Objects (`Email`, `DocumentNumber`, `Money`).

---

## 5. Clean Code Rules

### 5.1 Naming

| Element              | Convention             | Example                          |
| -------------------- | ---------------------- | -------------------------------- |
| Files                | `kebab-case`           | `product-category.entity.ts`     |
| Classes              | `PascalCase`           | `ProductCategory`                |
| Interfaces           | `PascalCase`, no `I`   | `ProductRepository`              |
| Variables / functions | `camelCase`           | `findById`                       |
| Constants            | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT`                |
| DB table names       | `snake_case` plural    | `product_categories`             |
| DB column names      | `snake_case`           | `category_id`, `created_at`      |
| Zod schemas          | `camelCase` + `Schema` | `productCategorySchema`          |
| Zod DTO types        | `PascalCase` + `Dto`   | `CreateProductCategoryDto`       |
| Path aliases         | `@layer/path`          | `@domain/product/product.entity` |
| Domain errors        | `<Entity><Reason>Error`| `CustomerAlreadyExistsError`     |

- Names must express intent, not implementation detail.
- Boolean variables: prefix with `is`, `has`, `can`, `should`.
- Avoid abbreviations unless universally understood (`id`, `dto`, `url`).

### 5.2 Functions & Methods

- One function = one responsibility. Split if it does two things.
- Maximum 3 parameters. More than that requires a typed options object or DTO.
- No boolean trap parameters — extract to explicit methods or a discriminated union.
- Keep functions short. If a body exceeds ~20 lines, it likely has more than one
  responsibility.

### 5.3 Classes

- Single Responsibility Principle.
- Composition over inheritance (except `BaseEntity` and framework base classes).
- No magic strings or numbers inline — extract to named constants in
  `@shared/constants` or as domain enum values.

### 5.4 Comments & Documentation

- Use `//` for single-line implementation notes.
- Use `/** JSDoc */` only on exported public APIs (classes, methods, types).
- Code must be self-documenting. Comments explain *why*, not *what*.
- Remove all `console.log` debug statements — use a logger service.
- Delete commented-out code — version control preserves history.
- Comments in English only.
- If a field preserves a known typo from an external system, add an inline comment:
  `// NOTE: typo kept intentional to match external schema`.
- Do not add emojis to markdown files.

---

## 6. Formatting (Prettier)

All code must pass `prettier --check`.

| Rule             | Value                                    |
| ---------------- | ---------------------------------------- |
| Print width      | 100 characters                           |
| Indentation      | 2 spaces (no tabs)                       |
| Semicolons       | required                                 |
| Quotes           | single quotes in TS/JS                   |
| JSX quotes       | double quotes                            |
| Trailing commas  | all (including function params)           |
| Bracket spacing  | `{ key: value }`                         |
| Arrow parens     | always — `(x) => x` not `x => x`        |
| End of line      | LF                                       |

Never manually wrap lines — let Prettier handle it at 100 chars.

---

## 7. Linting (ESLint + typescript-eslint)

Toolchain: `@eslint/js` recommended + `tseslint.configs.recommendedTypeChecked` +
`eslint-plugin-prettier`.

- All `prettier/prettier` violations are errors (block CI).
- All recommended rules are errors except the following, which are warnings:
  `no-floating-promises`, `no-unsafe-argument`, `no-unsafe-assignment`,
  `no-unsafe-member-access`, `no-unsafe-return`.
- `@typescript-eslint/no-explicit-any` is OFF. You may use `any` when genuinely needed,
  but document why with a comment.
- Ignored paths: `eslint.config.mjs`, `dist/`, `coverage/`, `node_modules/`.
- Do not modify `eslint.config.mjs`, `.prettierrc`, or `tsconfig.json` unless
  explicitly instructed.

---

## 8. Import Order

Always order imports as follows (separate each group with a blank line):

1. Node built-ins (`node:fs`, `node:path`)
2. Third-party packages (`typeorm`, `zod`, `@nestjs/...`)
3. Internal `@layer/*` aliases (alphabetical by layer)
4. Relative imports (`./`, `../`) — avoid across layers

---

## 9. Design Patterns

Apply patterns purposefully, never for their own sake.

| Pattern                    | When                                                    | Where                                  |
| -------------------------- | ------------------------------------------------------- | -------------------------------------- |
| Repository                 | Isolate persistence from domain                         | `@domain/` interface + `@infrastructure/` impl |
| Factory Method             | Complex object creation with validation                 | Domain entity classes                  |
| Use Case (Command/Query)   | Each discrete user action or query                      | `@application/use-cases/`              |
| Mapper                     | Convert between layers (entity <-> DTO)                 | `@application/` or `@presentation/`    |
| Strategy                   | Interchangeable algorithms                              | `@application/` + `@infrastructure/`   |
| Observer / Domain Event    | Decouple side-effects from core logic                   | `@domain/events/` + `@application/`    |
| Decorator                  | Cross-cutting concerns (logging, caching, retry)        | `@infrastructure/`                     |
| Specification              | Complex domain query predicates                         | `@domain/<feature>/specifications/`    |
| Null Object                | Avoid null checks for optional dependencies             | `@shared/` or feature domain           |

Anti-patterns to avoid: Anemic Domain Model, God Class (>~150 lines), Shotgun Surgery,
Primitive Obsession, Service Locator (use constructor injection instead).

---

## 10. File Templates & Locations

### Source Files

| Kind                 | Location                                                  |
| -------------------- | --------------------------------------------------------- |
| Entity               | `src/domain/<feature>/<feature>.entity.ts`                |
| Domain errors        | `src/domain/<feature>/errors/<error-name>.error.ts`       |
| Domain error index   | `src/domain/<feature>/errors/index.ts`                    |
| Repository interface | `src/domain/<feature>/<feature>.repository.ts`            |
| Use Case             | `src/application/<feature>/use-cases/<action>-<feature>.use-case.ts` |
| TypeORM repository   | `src/infrastructure/<feature>/<feature>.typeorm-repository.ts` |
| Controller           | `src/presentation/<feature>/<feature>.controller.ts`      |

### Test Files

| Test type   | Location                                       | Suffix                    |
| ----------- | ---------------------------------------------- | ------------------------- |
| Unit        | Next to source file in a `__tests__/` folder   | `.spec.ts`                |
| Integration | `test/integration/<feature>/`                  | `.integration-spec.ts`    |
| E2E         | `test/e2e/`                                    | `.e2e-spec.ts`            |

### Test Helpers

All reusable test utilities live under `<project-root>/test/helpers/` with the naming
pattern `<feature>.helper.ts`.

---

## 11. Test Implementation Standards

These rules apply inside every `*.spec.ts`, `*.integration-spec.ts`, and `*.e2e-spec.ts`
file.

### 11.1 Mandatory File Header

Every test file must begin with these two directives on the first two lines, before any
imports:

```typescript
// @ts-nocheck
/* eslint-disable */
```

`@ts-nocheck` must be a single-line comment (`//`). `/* eslint-disable */` is the only
valid file-level ESLint disable directive.

### 11.2 Test Helper Rules

- Never inline a factory or fixture in a spec if it could be reused. Extract to
  `test/helpers/<feature>.helper.ts`.
- Helper files must be typed and compile cleanly — the `@ts-nocheck` on spec files does
  not apply to helpers.
- Helpers export named functions only — no default exports.
- Import helpers using relative paths from the spec file.

### 11.3 General Test Writing Rules

- `describe` blocks mirror the class or function under test.
- Nested `describe` for method groups: `describe('execute()', () => { ... })`.
- `it` blocks must read as a sentence: `it('should throw when email already exists')`.
- Use `beforeEach` for setup; never share mutable state across `it` blocks without
  resetting.
- Prefer explicit `expect` assertions over snapshot tests for domain logic.
- Use `it()` consistently — never `test()`.
- Never use `fit()`, `fdescribe()`, `xit()`, `xdescribe()`, `.only`, or `.skip` in
  committed code.
- No `console.log` in test files.

### 11.4 The Cardinal Test Rule

When writing or fixing tests, NEVER alter, simplify, refactor, or "clean up" any source
file under `src/` unless the user explicitly asks for it. If a test cannot be written
because the implementation has a structural problem, stop and report the issue with a
clear explanation instead of silently modifying the source.

---

## 12. Work Process — Structured, Sequential & Incremental Implementation

This is the most critical process rule. Claude must never fill a file with a large volume
of code in a single pass. Implementation follows a deliberate, layered sequence.

### 12.1 The Mandatory Sequence for Any New Feature

```
Step 1 — Domain
  - Define the entity / value objects
  - Define repository interface (port)
  - Define domain errors

Step 2 — Application
  - Define use case input/output DTOs (Zod schemas)
  - Implement one use case at a time
  - Wire the use case to the repository port

Step 3 — Infrastructure
  - Implement the TypeORM repository (adapter)
  - Add any external service adapters needed

Step 4 — Presentation
  - Implement the controller / route handler
  - Map request -> DTO -> use case -> response

Step 5 — Tests (only when explicitly requested)
  - Unit test each use case
  - Integration test the repository adapter
  - E2E test the route
```

### 12.2 Incremental File Filling Rules

- One logical unit per response: one entity, one use case, one controller method.
- Never dump an entire module in a single block. If a file will have 5 methods,
  implement and confirm the first before adding the next.
- Stop and surface blockers early. If step N requires a decision about step N+1, stop
  and ask before writing more code.
- Never scaffold placeholder methods (`// TODO: implement`) — incomplete stubs must not
  exist in committed code.
- Maximum one new file per response unless the user explicitly requests a batch.
  State the plan, implement the first, wait for confirmation before proceeding.
- If the user asks to "go faster" or "do it all at once", Claude may batch steps within
  the same layer but never across layers in a single response.

### 12.3 Consistency Rules

- One pattern per problem across the entire codebase. If `Result<T, E>` is used in one
  use case, it is used in all use cases.
- If a naming or structural convention exists anywhere in the project, replicate it
  exactly. Do not invent a parallel convention.
- All new features must mirror the folder and file structure of an existing feature.

---

## 13. Absolute Prohibitions

For quick reference, Claude must NEVER do any of the following:

- Create `.js` files inside `src/`.
- Use `require()` instead of `import`.
- Use `any` without a justification comment.
- Import across layers in the wrong direction.
- Use relative imports across layer boundaries instead of `@layer/*` aliases.
- Write standalone DTO interfaces when a Zod schema already infers the type.
- Add new entities without the three Zod schemas.
- Modify `eslint.config.mjs`, `.prettierrc`, or `tsconfig.json` without explicit instruction.
- Throw exceptions in domain or application layers for business logic.
- Use `try/catch` in domain or application layers (infrastructure boundaries only).
- Return generic `Error` objects instead of typed domain errors.
- Write use cases that call other use cases — compose at the application service level.
- Add framework concerns to the domain layer.
- Create anemic entities that are pure data containers with no behaviour.
- Mix Result and throw approaches in the same layer.
- Simplify, refactor, or restructure existing code unless explicitly asked.
- Implement an entire feature end-to-end in one response without being asked.
- Add new structural conventions if an equivalent one already exists.
- Create tests unless explicitly instructed.
- Add emojis to markdown files.
- Leave `console.log` statements in any committed code.