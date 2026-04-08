import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = '伺服器內部錯誤';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        code = (resp.code as string) || this.getDefaultCode(status);
        message = (resp.message as string) || exception.message;
        details = resp.details as Record<string, unknown>;

        // class-validator 產生的陣列格式錯誤訊息
        if (Array.isArray(resp.message)) {
          message = '輸入資料驗證失敗';
          details = { errors: resp.message };
          code = 'INVALID_INPUT';
        }
      }
    }

    // 204 No Content 不回傳 body
    if (status === HttpStatus.NO_CONTENT) {
      response.status(status).send();
      return;
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
    });
  }

  private getDefaultCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'INVALID_INPUT',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return codeMap[status] || 'INTERNAL_ERROR';
  }
}
