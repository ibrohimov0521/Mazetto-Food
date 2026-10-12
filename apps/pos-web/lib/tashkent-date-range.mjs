const tashkentDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function assertTashkentCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("Expected a YYYY-MM-DD date");
  }

  const instant = new Date(`${value}T00:00:00.000+05:00`);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("Invalid date");
  }

  const parts = tashkentDateParts(instant);
  if (`${parts.year}-${parts.month}-${parts.day}` !== value) {
    throw new RangeError("Invalid calendar date");
  }
}

function tashkentDateParts(instant) {
  return Object.fromEntries(
    tashkentDateFormatter
      .formatToParts(instant)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
}

/** Return a Date's calendar day in the restaurant's fixed Tashkent timezone. */
export function tashkentCalendarDate(instant = new Date()) {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    throw new RangeError("Invalid instant");
  }
  const parts = tashkentDateParts(instant);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function tashkentBoundaryUtc(value, time) {
  assertTashkentCalendarDate(value);
  return new Date(`${value}T${time}+05:00`).toISOString();
}

/** Convert an HTML date input's start of day in Tashkent to an ISO instant. */
export function tashkentDateStartUtc(value) {
  return tashkentBoundaryUtc(value, "00:00:00.000");
}

/** Convert an HTML date input's end of day in Tashkent to an ISO instant. */
export function tashkentDateEndUtc(value) {
  return tashkentBoundaryUtc(value, "23:59:59.999");
}
