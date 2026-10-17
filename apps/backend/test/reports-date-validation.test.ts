import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ReportPreset,
  ReportQueryDto,
} from "../src/modules/reports/dto/report-query.dto";
import { resolveReportRange } from "../src/modules/reports/report-range";

test("custom report permits 366 calendar days but rejects 367", () => {
  assert.doesNotThrow(() =>
    resolveReportRange({
      preset: ReportPreset.CUSTOM,
      from: "2025-01-01",
      to: "2026-01-01",
    }),
  );
  assert.throws(
    () =>
      resolveReportRange({
        preset: ReportPreset.CUSTOM,
        from: "2025-01-01",
        to: "2026-01-02",
      }),
    /366 kundan/,
  );
});

test("custom report rejects impossible ISO calendar dates", async () => {
  const query = plainToInstance(ReportQueryDto, {
    preset: ReportPreset.CUSTOM,
    from: "2026-02-31",
    to: "2026-03-10",
  });
  const errors = await validate(query);

  assert.ok(errors.some((error) => error.property === "from"));
});
