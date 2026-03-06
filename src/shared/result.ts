export type Success<T> = { readonly ok: true; readonly value: T };
export type Failure<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Success<T> | Failure<E>;

// ── Constructors ──────────────────────────────────────────────
export const ok = <T>(value: T): Success<T> => ({ ok: true, value });
export const err = <E>(error: E): Failure<E> => ({ ok: false, error });

// ── Type guards ───────────────────────────────────────────────
export const isOk = <T, E>(r: Result<T, E>): r is Success<T> => r.ok === true;
export const isErr = <T, E>(r: Result<T, E>): r is Failure<E> => r.ok === false;

// ── Railway combinators ───────────────────────────────────────

export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => (result.ok ? fn(result.value) : result);

export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

export const asyncFlatMap = async <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> => (result.ok ? fn(result.value) : result);

export const fromThrowable = <T, E = Error>(
  fn: () => T,
  onThrow: (e: unknown) => E,
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(onThrow(e));
  }
};

export const fromPromise = async <T, E = Error>(
  promise: Promise<T>,
  onReject: (e: unknown) => E,
): Promise<Result<T, E>> => {
  try {
    return ok(await promise);
  } catch (e) {
    return err(onReject(e));
  }
};
