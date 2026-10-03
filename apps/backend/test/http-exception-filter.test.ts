import assert from "node:assert/strict";
import test from "node:test";
import type { ArgumentsHost } from "@nestjs/common";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

test("500 response and server log share the same request ID", () => {
  const requestId = "trace-kitchen-123";
  let responseStatus = 0;
  let responseBody: unknown;
  let loggedMessage = "";
  let loggedStack: string | undefined;
  const filter = new HttpExceptionFilter();

  Object.defineProperty(filter, "logger", {
    value: {
      error(message: string, stack?: string) {
        loggedMessage = message;
        loggedStack = stack;
      },
    },
  });

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        url: "/api/v1/kitchen/orders",
        correlationId: requestId,
      }),
      getResponse: () => ({
        status(status: number) {
          responseStatus = status;
          return this;
        },
        json(body: unknown) {
          responseBody = body;
        },
      }),
    }),
  } as unknown as ArgumentsHost;

  filter.catch(new Error("database query failed"), host);

  assert.equal(responseStatus, 500);
  assert.equal(
    (responseBody as { error: { requestId: string } }).error.requestId,
    requestId,
  );
  assert.match(loggedMessage, new RegExp(`requestId=${requestId}`));
  assert.match(loggedStack ?? "", /database query failed/);
});

