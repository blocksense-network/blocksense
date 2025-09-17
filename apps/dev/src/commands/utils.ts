export function formatTimestamp(timestamp: bigint | number | string): string {
  const seconds = Number(timestamp);
  const date = new Date(seconds * 1000);
  const padToTwoDigits = (n: number) => String(n).padStart(2, '0');
  const formattedTimestamp =
    `${padToTwoDigits(date.getHours())}:${padToTwoDigits(date.getMinutes())}:${padToTwoDigits(date.getSeconds())}` +
    ` ${padToTwoDigits(date.getDate())}-${padToTwoDigits(date.getMonth() + 1)}-${date.getFullYear()}` +
    ` (${timestamp})`;
  return formattedTimestamp;
}
