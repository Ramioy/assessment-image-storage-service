// @ts-nocheck
/* eslint-disable */

import {
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  mapErr,
  asyncFlatMap,
  fromThrowable,
  fromPromise,
} from '@shared/result';

describe('result', () => {
  describe('ok()', () => {
    it('should create a Success with ok=true and the given value', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });
  });

  describe('err()', () => {
    it('should create a Failure with ok=false and the given error', () => {
      const error = new Error('fail');
      const result = err(error);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(error);
    });
  });

  describe('isOk()', () => {
    it('should return true for a Success', () => {
      expect(isOk(ok('x'))).toBe(true);
    });

    it('should return false for a Failure', () => {
      expect(isOk(err('e'))).toBe(false);
    });
  });

  describe('isErr()', () => {
    it('should return true for a Failure', () => {
      expect(isErr(err('e'))).toBe(true);
    });

    it('should return false for a Success', () => {
      expect(isErr(ok('x'))).toBe(false);
    });
  });

  describe('map()', () => {
    it('should transform the value on Success', () => {
      const result = map(ok(2), (n) => n * 3);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(6);
    });

    it('should pass through a Failure unchanged', () => {
      const failure = err('boom');
      const result = map(failure, (n) => n * 3);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('boom');
    });
  });

  describe('flatMap()', () => {
    it('should chain a Success through the given function', () => {
      const result = flatMap(ok(5), (n) => ok(n + 1));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(6);
    });

    it('should return err from the chained function when it fails', () => {
      const result = flatMap(ok(5), () => err('inner error'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('inner error');
    });

    it('should pass through a Failure without calling the function', () => {
      const fn = jest.fn();
      const result = flatMap(err('original'), fn);
      expect(fn).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('original');
    });
  });

  describe('mapErr()', () => {
    it('should transform the error on a Failure', () => {
      const result = mapErr(err('raw'), (e) => new Error(e));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBe('raw');
    });

    it('should pass through a Success unchanged', () => {
      const result = mapErr(ok(99), () => new Error('never'));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(99);
    });
  });

  describe('asyncFlatMap()', () => {
    it('should chain a Success through the async function', async () => {
      const result = await asyncFlatMap(ok(3), async (n) => ok(n * 2));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(6);
    });

    it('should return err from the async function when it fails', async () => {
      const result = await asyncFlatMap(ok(3), async () => err('async fail'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('async fail');
    });

    it('should pass through a Failure without calling the function', async () => {
      const fn = jest.fn();
      const result = await asyncFlatMap(err('pass-through'), fn);
      expect(fn).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
    });
  });

  describe('fromThrowable()', () => {
    it('should return ok when the function succeeds', () => {
      const result = fromThrowable(() => 42, (e) => String(e));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });

    it('should return err when the function throws', () => {
      const result = fromThrowable(
        () => { throw new Error('thrown'); },
        (e) => (e as Error).message,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('thrown');
    });
  });

  describe('fromPromise()', () => {
    it('should return ok when the promise resolves', async () => {
      const result = await fromPromise(Promise.resolve('value'), (e) => String(e));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('value');
    });

    it('should return err when the promise rejects', async () => {
      const result = await fromPromise(
        Promise.reject(new Error('rejected')),
        (e) => (e as Error).message,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('rejected');
    });
  });
});
