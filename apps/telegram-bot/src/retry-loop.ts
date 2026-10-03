export function startRetryLoop(
  task: () => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;
  let running = false;

  const run = async () => {
    if (stopped || running) return;

    running = true;
    try {
      await task();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => void run(), intervalMs);
  interval.unref();
  void run();

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
