export interface Activity {
  activity_id: string;
  name: string;
  category: string;
  tags: string[];
  reminder_interval_days: number | null; // e.g. 14 days, or null
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  archived: boolean;
  color?: string;
  icon?: string;
}

export interface LifeEvent {
  event_id: string;
  activity_id: string;
  activity_name: string; // snapshot for convenience
  occurred_at: string; // ISO 8601 with timezone (actual occurrence)
  recorded_at: string; // ISO 8601 with timezone (when logged)
  notes?: string;
  tags: string[];
  updated_at: string; // ISO 8601
}

export interface ActivitySummary {
  activity: Activity;
  lastEvent: LifeEvent | null;
  daysAgo: number | null;
  totalOccurrences: number;
  occurrencesThisMonth: number;
  occurrencesThisYear: number;
  isOverdue: boolean;
  daysOverdue: number | null;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: Date | null;
  errorMessage?: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
}

export type ViewTab = 'dashboard' | 'history' | 'activities' | 'settings';
