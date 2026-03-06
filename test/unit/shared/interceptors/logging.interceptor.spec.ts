// @ts-nocheck
/* eslint-disable */

import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from '@shared/interceptors/logging.interceptor';

function makeContext(method = 'GET', url = '/test') {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ method, url }),
      getResponse: jest.fn().mockReturnValue({ statusCode: 200 }),
    }),
  };
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    jest.spyOn(interceptor['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(interceptor['logger'], 'error').mockImplementation(() => {});
  });

  describe('intercept()', () => {
    it('should log the request method, url, status code, and elapsed time on success', (done) => {
      const context = makeContext('POST', '/api/v1/images');
      const next = { handle: jest.fn().mockReturnValue(of({ id: '123' })) };

      interceptor.intercept(context as any, next).subscribe({
        next: () => {
          expect(interceptor['logger'].log).toHaveBeenCalledWith(
            expect.stringMatching(/POST \/api\/v1\/images 200 - \d+ms/),
          );
          done();
        },
      });
    });

    it('should log an error message and re-throw the error on failure', (done) => {
      const context = makeContext('DELETE', '/api/v1/images/123');
      const error = new Error('handler failed');
      const next = { handle: jest.fn().mockReturnValue(throwError(() => error)) };

      interceptor.intercept(context as any, next).subscribe({
        error: (e) => {
          expect(e).toBe(error);
          expect(interceptor['logger'].error).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE \/api\/v1\/images\/123 ERROR - \d+ms/),
          );
          done();
        },
      });
    });
  });
});
