import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";
import type { ApiSuccessResponse } from "../types/api-response";

type ExistingResponse = {
  success?: boolean;
};

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown): unknown => {
        if (this.hasSuccessFlag(data)) {
          return data;
        }

        const response: ApiSuccessResponse<unknown> = {
          success: true,
          data,
        };

        return response;
      }),
    );
  }

  private hasSuccessFlag(value: unknown): value is ExistingResponse {
    return typeof value === "object" && value !== null && "success" in value;
  }
}
