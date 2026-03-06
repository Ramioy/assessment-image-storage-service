// @ts-nocheck
/* eslint-disable */

import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpErrorFilter } from '@shared/filters/http-exception.filter';

function makeReply(sent = false) {
  const reply = {
    sent,
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  return reply;
}

function makeHost(reply: ReturnType<typeof makeReply>) {
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(reply),
    }),
  };
}

describe('HttpErrorFilter', () => {
  let filter: HttpErrorFilter;

  beforeEach(() => {
    filter = new HttpErrorFilter();
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => {});
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => {});
  });

  describe('catch()', () => {
    it('should respond with the HttpException status and message for a 4xx error', () => {
      const reply = makeReply();
      const host = makeHost(reply);
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host as any);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND }),
      );
      expect(filter['logger'].warn).toHaveBeenCalled();
    });

    it('should respond with 500 and log error for a 5xx HttpException', () => {
      const reply = makeReply();
      const host = makeHost(reply);
      const exception = new HttpException('Server Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, host as any);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(filter['logger'].error).toHaveBeenCalled();
    });

    it('should use the exception message for a plain Error', () => {
      const reply = makeReply();
      const host = makeHost(reply);
      const exception = new Error('something went wrong');

      filter.catch(exception, host as any);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'something went wrong' }),
      );
    });

    it('should use a generic message for an unknown non-Error exception', () => {
      const reply = makeReply();
      const host = makeHost(reply);

      filter.catch({ weirdObject: true }, host as any);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Internal server error' }),
      );
    });

    it('should not send a response when reply.sent is true', () => {
      const reply = makeReply(true);
      const host = makeHost(reply);
      const exception = new HttpException('Already Sent', HttpStatus.BAD_REQUEST);

      filter.catch(exception, host as any);

      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should include a timestamp in the response body', () => {
      const reply = makeReply();
      const host = makeHost(reply);

      filter.catch(new HttpException('test', HttpStatus.BAD_REQUEST), host as any);

      const sentPayload = reply.send.mock.calls[0][0];
      expect(sentPayload.timestamp).toBeDefined();
    });

    it('should handle HttpException with an object response body (4xx — logger.warn)', () => {
      const reply = makeReply();
      const host = makeHost(reply);
      const bodyObj = { error: 'Validation failed', details: ['field required'] };
      const exception = new HttpException(bodyObj, HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, host as any);

      expect(reply.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(filter['logger'].warn).toHaveBeenCalled();
    });

    it('should JSON.stringify an object message when logging a 5xx error', () => {
      const reply = makeReply();
      const host = makeHost(reply);
      const bodyObj = { error: 'Internal failure', code: 'DB_DOWN' };
      const exception = new HttpException(bodyObj, HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, host as any);

      expect(filter['logger'].error).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(bodyObj)),
        expect.anything(),
      );
    });
  });
});
