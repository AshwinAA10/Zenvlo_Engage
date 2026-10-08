import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let errorDetails: any = null;

    let retryAfter: number | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        message = (exceptionResponse as any).message || exception.message;
        errorDetails = (exceptionResponse as any).errors || null;
        if ((exceptionResponse as any).retryAfter !== undefined) {
          retryAfter = (exceptionResponse as any).retryAfter;
          if (typeof response.header === 'function') {
            response.header('Retry-After', String(retryAfter));
          } else if (typeof response.setHeader === 'function') {
            response.setHeader('Retry-After', String(retryAfter));
          }
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        {
          err: exception.message,
          stack: exception.stack,
          url: request.url,
          method: request.method,
        },
        'Unhandled exception caught',
      );
    }

    const payload = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url || request.raw?.url,
      message,
      ...(retryAfter !== undefined ? { retryAfter } : {}),
      ...(errorDetails ? { errors: errorDetails } : {}),
    };

    if (typeof response.status === 'function') {
      response.status(status);
    }

    if (typeof response.send === 'function') {
      response.send(payload);
    } else if (typeof response.json === 'function') {
      response.json(payload);
    }
  }
}
