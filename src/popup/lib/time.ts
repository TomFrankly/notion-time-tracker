/**
 * Format milliseconds to HH:MM:SS string
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

/**
 * Format milliseconds to a shorter display (e.g., "2h 30m" or "45m")
 */
export function formatTimeShort(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  
  if (minutes > 0) {
    return `${minutes}m`;
  }
  
  const seconds = Math.floor(ms / 1000);
  return `${seconds}s`;
}

/**
 * Pad a number with leading zero
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * Calculate elapsed time from start timestamp
 */
export function getElapsedTime(startTimestamp: number | null): number {
  if (!startTimestamp) return 0;
  return Date.now() - startTimestamp;
}

/**
 * Calculate total time from array of work sessions
 * Returns both the completed time and info about any active session
 */
export function calculateTotalTime(
  sessions: Array<{ startDate: string | null; endDate: string | null; isActive?: boolean; id?: string }>
): { completedTime: number; activeSession: { id: string; startTime: number } | null } {
  let completedTime = 0;
  let activeSession: { id: string; startTime: number } | null = null;

  for (const session of sessions) {
    if (!session.startDate) continue;
    
    const start = new Date(session.startDate).getTime();
    
    if (session.isActive && session.id) {
      // This is an active session - store its info
      activeSession = { id: session.id, startTime: start };
    } else if (session.endDate) {
      // Completed session - add to total
      const end = new Date(session.endDate).getTime();
      completedTime += (end - start);
    }
  }

  return { completedTime, activeSession };
}

/**
 * Get current ISO date string
 */
export function getCurrentISODate(): string {
  return new Date().toISOString();
}

/**
 * Parse ISO date string to timestamp
 */
export function parseISODate(isoDate: string): number {
  return new Date(isoDate).getTime();
}
