/**
 * Date and Time utilities for LifeLog
 * Ensures reliable timezone handling, ISO 8601 compliance, and precise elapsed calculations.
 */

/**
 * Format relative elapsed or future time in human-readable plain language.
 * Handles singular/plural ("1 day ago" vs "2 days ago"), future dates, and sub-hour precision.
 */
export function formatRelativeTime(dateInput: string | Date, baseNow: Date = new Date()): string {
  if (!dateInput) return 'Never';
  const targetDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(targetDate.getTime())) return 'Invalid date';

  const diffMs = baseNow.getTime() - targetDate.getTime();
  const isFuture = diffMs < 0;
  const absDiffSec = Math.floor(Math.abs(diffMs) / 1000);

  if (absDiffSec < 45) {
    return isFuture ? 'In a few seconds' : 'Just now';
  }

  const absDiffMin = Math.floor(absDiffSec / 60);
  if (absDiffMin < 60) {
    const unit = absDiffMin === 1 ? 'minute' : 'minutes';
    return isFuture ? `In ${absDiffMin} ${unit}` : `${absDiffMin} ${unit} ago`;
  }

  const absDiffHours = Math.floor(absDiffMin / 60);
  if (absDiffHours < 24) {
    const unit = absDiffHours === 1 ? 'hour' : 'hours';
    return isFuture ? `In ${absDiffHours} ${unit}` : `${absDiffHours} ${unit} ago`;
  }

  const absDiffDays = Math.floor(absDiffHours / 24);
  if (absDiffDays === 1) {
    return isFuture ? 'Tomorrow' : 'Yesterday';
  }

  if (absDiffDays < 7) {
    return isFuture ? `In ${absDiffDays} days` : `${absDiffDays} days ago`;
  }

  const absDiffWeeks = Math.floor(absDiffDays / 7);
  if (absDiffDays < 30) {
    const unit = absDiffWeeks === 1 ? 'week' : 'weeks';
    return isFuture ? `In ${absDiffWeeks} ${unit}` : `${absDiffWeeks} ${unit} ago`;
  }

  const absDiffMonths = Math.floor(absDiffDays / 30.4375);
  if (absDiffDays < 365) {
    const unit = absDiffMonths === 1 ? 'month' : 'months';
    return isFuture ? `In ${absDiffMonths} ${unit}` : `${absDiffMonths} ${unit} ago`;
  }

  const absDiffYears = Math.floor(absDiffDays / 365.25);
  const unit = absDiffYears === 1 ? 'year' : 'years';
  return isFuture ? `In ${absDiffYears} ${unit}` : `${absDiffYears} ${unit} ago`;
}

/**
 * Formats a date into a localized readable date-time string.
 * e.g., "Oct 12, 2026, 8:35 PM"
 */
export function formatDateTime(dateInput: string | Date): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formats a date into date-only string.
 * e.g., "Oct 12, 2026"
 */
export function formatDateOnly(dateInput: string | Date): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats a date into time-only string.
 * e.g., "8:35 PM"
 */
export function formatTimeOnly(dateInput: string | Date): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Converts a Date object or ISO string to the value required by <input type="datetime-local">
 * Local time string formatted as "YYYY-MM-DDTHH:mm"
 */
export function toDatetimeLocalValue(date: Date = new Date()): string {
  const pad = (num: number) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a local datetime-local value ("YYYY-MM-DDTHH:mm") into a full ISO 8601 string.
 */
export function fromDatetimeLocalValue(value: string): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

/**
 * Calculates number of days elapsed between occurredAt and now.
 * Returns null if no date provided.
 */
export function getDaysElapsed(dateInput?: string | Date | null, baseNow: Date = new Date()): number | null {
  if (!dateInput) return null;
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return null;

  const diffMs = baseNow.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Evaluates whether an activity is overdue based on reminder interval days.
 */
export function checkReminderStatus(
  latestOccurredAt?: string | null,
  reminderIntervalDays?: number | null,
  baseNow: Date = new Date()
): { isOverdue: boolean; daysRemaining: number | null; daysOverdue: number | null } {
  if (!reminderIntervalDays || reminderIntervalDays <= 0) {
    return { isOverdue: false, daysRemaining: null, daysOverdue: null };
  }

  if (!latestOccurredAt) {
    // Never occurred yet, consider overdue if interval is set
    return { isOverdue: true, daysRemaining: 0, daysOverdue: 0 };
  }

  const daysElapsed = getDaysElapsed(latestOccurredAt, baseNow);
  if (daysElapsed === null) {
    return { isOverdue: false, daysRemaining: null, daysOverdue: null };
  }

  if (daysElapsed > reminderIntervalDays) {
    return {
      isOverdue: true,
      daysRemaining: 0,
      daysOverdue: daysElapsed - reminderIntervalDays,
    };
  }

  return {
    isOverdue: false,
    daysRemaining: reminderIntervalDays - daysElapsed,
    daysOverdue: null,
  };
}

/**
 * Checks if a date occurs in the same calendar month as baseNow.
 */
export function isThisMonth(dateInput: string | Date, baseNow: Date = new Date()): boolean {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return false;
  return date.getFullYear() === baseNow.getFullYear() && date.getMonth() === baseNow.getMonth();
}

/**
 * Checks if a date occurs in the same calendar year as baseNow.
 */
export function isThisYear(dateInput: string | Date, baseNow: Date = new Date()): boolean {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return false;
  return date.getFullYear() === baseNow.getFullYear();
}
