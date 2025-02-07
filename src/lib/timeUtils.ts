export const TIME_OFFSET_HOURS = 9; // 로컬과 DB 서버 간 시간 차이 (로컬이 더 빠름)

export function getDbTimeNow(): Date {
  // 현재 로컬 시간에서 TIME_OFFSET_HOURS 만큼 빼서 DB 서버 시간을 반환합니다.
  return new Date(Date.now() - TIME_OFFSET_HOURS * 60 * 60 * 1000);
}

export function getDbTimeISOString(): string {
  return getDbTimeNow().toISOString();
}

export function getDbTimeXMinutesAgo(minutes: number): string {
  return new Date(getDbTimeNow().getTime() - minutes * 60 * 1000).toISOString();
} 