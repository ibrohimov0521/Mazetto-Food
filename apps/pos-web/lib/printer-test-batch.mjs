/**
 * Test configured printers in order. A single device failure must not prevent
 * the remaining selected queues from being checked.
 *
 * @template {{ name: string, displayName?: string }} T
 * @param {T[]} printers
 * @param {(printer: T) => Promise<void>} testPrinter
 * @param {(results: { name: string, ok: boolean, message: string }[]) => void} [onResult]
 */
export async function runPrinterTestsIndependently(
  printers,
  testPrinter,
  onResult,
) {
  const results = [];
  for (const printer of printers) {
    let result;
    try {
      await testPrinter(printer);
      result = {
        name: printer.displayName || printer.name,
        ok: true,
        message: "Windows chop etishni qabul qildi",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        name: printer.displayName || printer.name,
        ok: false,
        message: message.slice(0, 240),
      };
    }
    results.push(result);
    onResult?.([...results]);
  }
  return results;
}
