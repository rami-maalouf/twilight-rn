import { wallTime, resolveWallTime } from "./session-editor";

test("shows original wall time when device is elsewhere and preserves seconds", () => {
  const original = "2026-07-02T03:14:27.123Z";
  const wall = wallTime(original, "America/Toronto");
  expect(wall).toEqual({ date: "2026-07-01", minutes: 23 * 60 + 14 });
  expect(resolveWallTime(wall, "America/Toronto", original)).toBe(original);
});
test("resolves each travel endpoint in its own zone across midnight", () => {
  expect(
    resolveWallTime(
      { date: "2026-07-01", minutes: 23 * 60 },
      "America/Toronto",
    ),
  ).toBe("2026-07-02T03:00:00.000Z");
  expect(
    resolveWallTime({ date: "2026-07-02", minutes: 8 * 60 }, "Europe/London"),
  ).toBe("2026-07-02T07:00:00.000Z");
});
test("rejects spring-forward gaps and invalid calendar dates", () => {
  expect(() =>
    resolveWallTime({ date: "2026-03-08", minutes: 150 }, "America/Toronto"),
  ).toThrow(/does not exist/);
  expect(() =>
    resolveWallTime({ date: "2026-02-30", minutes: 60 }, "UTC"),
  ).toThrow();
});
test("keeps the original fall-back occurrence and rejects new ambiguous times", () => {
  const wall = { date: "2026-11-01", minutes: 90 };
  expect(
    resolveWallTime(wall, "America/Toronto", "2026-11-01T06:30:00.000Z"),
  ).toBe("2026-11-01T06:30:00.000Z");
  expect(() => resolveWallTime(wall, "America/Toronto")).toThrow(/twice/);
});

test("explicitly selects either repeated hour", () => {
  const wall = { date: "2026-11-01", minutes: 90 };
  expect(resolveWallTime(wall, "America/Toronto", undefined, "First")).toBe(
    "2026-11-01T05:30:00.000Z",
  );
  expect(resolveWallTime(wall, "America/Toronto", undefined, "Second")).toBe(
    "2026-11-01T06:30:00.000Z",
  );
});
test("handles a half-hour offset zone", () => {
  expect(
    resolveWallTime({ date: "2026-07-02", minutes: 420 }, "Asia/Kolkata"),
  ).toBe("2026-07-02T01:30:00.000Z");
});
