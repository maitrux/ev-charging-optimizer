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
