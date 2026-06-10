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
