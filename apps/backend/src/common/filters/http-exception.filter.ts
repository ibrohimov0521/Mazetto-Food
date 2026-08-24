import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { ApiErrorResponse } from "../types/api-response";

type ExceptionResponse = {
  error?: string;
  message?: string | string[];
  statusCode?: number;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const normalizedResponse =
      typeof exceptionResponse === "object" && exceptionResponse !== null
        ? (exceptionResponse as ExceptionResponse)
        : undefined;
    const message =
      normalizedResponse?.message ??
      (typeof exceptionResponse === "string" ? exceptionResponse : "Internal server error");
    const code = normalizedResponse?.error ?? HttpStatus[statusCode] ?? "Error";

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.method} ${request.url} failed`, stack);
    }

    const body: ApiErrorResponse = {
      success: false,
      error: {
        statusCode,
        code,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(statusCode).json(body);
  }
}
