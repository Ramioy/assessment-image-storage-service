import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<FastifyReply>();
        const statusCode = response.statusCode;
        const elapsed = Date.now() - now;
        this.logger.log(`${method} ${url} ${statusCode} - ${elapsed}ms`);
      }),
      catchError((error: Error) => {
        const elapsed = Date.now() - now;
        this.logger.error(`${method} ${url} ERROR - ${elapsed}ms`);
        return throwError(() => error);
      }),
    );
  }
}
