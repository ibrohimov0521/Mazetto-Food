export class PrintOutcomeUnknownError extends Error {
  readonly code = "PRINT_OUTCOME_UNKNOWN";

  constructor(message: string) {
    super(message);
    this.name = "PrintOutcomeUnknownError";
  }
}

export function isPrintOutcomeUnknown(error: unknown): boolean {
  return (
    error instanceof PrintOutcomeUnknownError ||
    (error instanceof Error &&
      "code" in error &&
      error.code === "PRINT_OUTCOME_UNKNOWN")
  );
}

export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    operation,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(onTimeout()), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
