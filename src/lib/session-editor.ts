export type WallTime = { date: string; minutes: number };

export function wallTime(iso: string, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function sameWall(left: WallTime, right: WallTime) {
  return left.date === right.date && left.minutes === right.minutes;
}

export function resolveWallTime(
  wall: WallTime,
  zone: string,
  original?: string,
  occurrence?: "First" | "Second",
): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(wall.date) ||
    !Number.isInteger(wall.minutes) ||
    wall.minutes < 0 ||
    wall.minutes >= 1440
  ) {
    throw new Error("Enter a valid date and time.");
  }
  const naive = Date.parse(`${wall.date}T00:00:00Z`) + wall.minutes * 60000;
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 10) !== wall.date
  ) {
    throw new Error("Enter a valid calendar date.");
  }
  if (original && !occurrence && sameWall(wallTime(original, zone), wall))
    return original;
  const offsets = new Set<number>();
  // sample both sides of zone transitions, including half-hour changes.
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = naive + hours * 3600000;
    const local = wallTime(new Date(sample).toISOString(), zone);
    offsets.add(
      Date.parse(`${local.date}T00:00:00Z`) + local.minutes * 60000 - sample,
    );
  }
  const candidates = [...offsets]
    .map((offset) => new Date(naive - offset).toISOString())
    .filter((iso) => sameWall(wallTime(iso, zone), wall))
    .sort();
  if (!candidates.length)
    throw new Error(
      `This time does not exist in ${zone} because the clocks change. Choose another time.`,
    );
  if (candidates.length > 1 && !occurrence)
    throw new Error(
      `This time occurs twice in ${zone}. Choose First or Second occurrence.`,
    );
  return candidates[occurrence === "Second" ? candidates.length - 1 : 0];
}
