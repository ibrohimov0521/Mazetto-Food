export type CsvValue = string | number | null | undefined;

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const encode = (value: CsvValue) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  return [headers, ...rows]
    .map((row) => row.map(encode).join(","))
    .join("\r\n");
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
): void {
  const blob = new Blob(["\uFEFF", toCsv(headers, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
