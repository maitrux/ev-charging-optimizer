const DE_DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

export function getDefaultTargetTimeUtc(): string {
  const date = new Date();

  date.setTime(date.getTime() + 24 * 60 * 60 * 1000);

  return date.toISOString();
}

export function utcIsoToDatetimeLocal(isoUtc: string): string {
  const date = new Date(isoUtc);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function datetimeLocalToUtcIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function formatDateTimeDeDe(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString("de-DE", DE_DATE_TIME_FORMAT);
}

function formatChartAxisTime(isoUtc: string): string {
  return new Date(isoUtc).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChartAxisDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Chart x-axis labels: date is shown only on the first tick of each day. */
export function formatChartAxisLabels(timestamps: string[]): string[] {
  let previousDateKey = "";

  return timestamps.map((timestamp) => {
    const dateKey = new Date(timestamp).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const time = formatChartAxisTime(timestamp);

    if (dateKey !== previousDateKey) {
      previousDateKey = dateKey;
      return `${formatChartAxisDate(timestamp)}\n${time}`;
    }

    return time;
  });
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Fraction of an hourly charging slot that is available before the target time.
 * Forecast timestamps are hour starts; e.g. target 13:30 in the 13:00 bucket → 0.5.
 */
export function getChargingSlotDurationHours(
  hourTimestamp: string,
  targetTimeIso: string,
): number {
  const hourStartMs = new Date(hourTimestamp).getTime();
  const targetMs = new Date(targetTimeIso).getTime();
  const hourEndMs = hourStartMs + MS_PER_HOUR;

  if (targetMs <= hourStartMs) {
    return 0;
  }

  if (targetMs >= hourEndMs) {
    return 1;
  }

  return (targetMs - hourStartMs) / MS_PER_HOUR;
}

/**
 * Maps a target time onto a categorical hourly chart axis.
 * Forecast timestamps are hour starts; sub-hour targets are placed proportionally
 * between the surrounding hour buckets.
 */
export function getTargetTimeChartAxisPosition(
  forecastTimestamps: string[],
  targetTimeIso: string,
): number {
  if (forecastTimestamps.length === 0) {
    return 0;
  }

  const targetMs = new Date(targetTimeIso).getTime();
  const hourStarts = forecastTimestamps.map(
    (timestamp) => new Date(timestamp).getTime(),
  );

  if (targetMs <= hourStarts[0]) {
    return 0;
  }

  const lastIndex = hourStarts.length - 1;

  if (targetMs >= hourStarts[lastIndex]) {
    return lastIndex;
  }

  for (let index = 0; index < lastIndex; index++) {
    const hourStart = hourStarts[index];
    const nextHourStart = hourStarts[index + 1];

    if (targetMs >= hourStart && targetMs < nextHourStart) {
      const progress = (targetMs - hourStart) / (nextHourStart - hourStart);

      return index + progress;
    }
  }

  return lastIndex;
}
