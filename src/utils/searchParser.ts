import { Activity, LifeEvent, ActivitySummary } from '../types';
import { formatRelativeTime, formatDateTime, getDaysElapsed, isThisMonth, isThisYear } from './dateUtils';

export interface QueryResult {
  isSmartQuery: boolean;
  headline?: string;
  subtext?: string;
  badge?: string;
  matchedActivity?: Activity;
  matchedEvents?: LifeEvent[];
  matchedActivities?: Activity[];
  statCount?: number;
}

export function parseSmartQuery(
  rawQuery: string,
  activities: Activity[],
  events: LifeEvent[],
  summaries: ActivitySummary[],
  baseNow: Date = new Date()
): QueryResult | null {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;

  // Helper to match activity name from substring or keywords
  const findActivity = (text: string): Activity | undefined => {
    // 1. Exact or substring match
    const direct = activities.find((a) => {
      const name = a.name.toLowerCase();
      return text.includes(name) || name.includes(text);
    });
    if (direct) return direct;

    // 2. Token / keyword matching (e.g. "cut my beard" -> "Beard Cut")
    const textWords = text.split(/\W+/).filter((w) => w.length > 2);
    return activities.find((a) => {
      const actWords = a.name.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      if (actWords.length === 0) return false;
      const matched = actWords.filter((aw) =>
        textWords.some((tw) => tw.includes(aw) || aw.includes(tw))
      );
      return matched.length > 0;
    });
  };

  // Pattern 1: "Which activities have not happened in X days?" or "not happened in 30 days" or "inactive"
  const notHappenedMatch = query.match(/(?:not happened|haven'?t done|inactive|no events).*(?:in\s+(\d+)\s+days?|for\s+(\d+)\s+days?)/i) ||
    query.match(/(\d+)\s+days?.*(?:ago|inactive|since)/i);

  if (notHappenedMatch || query.includes('not done for a long time') || query.includes('overdue')) {
    const daysThreshold = notHappenedMatch
      ? parseInt(notHappenedMatch[1] || notHappenedMatch[2] || notHappenedMatch[3] || '30', 10)
      : 14;

    const inactiveSummaries = summaries.filter((s) => {
      if (s.activity.archived) return false;
      if (!s.lastEvent) return true;
      const days = getDaysElapsed(s.lastEvent.occurred_at, baseNow);
      return days !== null && days >= daysThreshold;
    });

    const count = inactiveSummaries.length;
    return {
      isSmartQuery: true,
      headline: `${count} ${count === 1 ? 'activity has' : 'activities have'} not occurred in ${daysThreshold}+ days`,
      subtext: `Showing activities with no occurrences since ${daysThreshold} days ago.`,
      badge: `${daysThreshold}+ days inactive`,
      matchedActivities: inactiveSummaries.map((s) => s.activity),
      matchedEvents: [],
      statCount: count,
    };
  }

  // Pattern 2: "How many times did I [activity] this month/year?" or "count [activity]"
  const countMatch = query.match(/how many times|how often|count|times did i/i);
  if (countMatch) {
    const isYear = query.includes('year');
    const isMonth = query.includes('month') || (!isYear);
    const targetActivity = findActivity(query);

    if (targetActivity) {
      const actEvents = events.filter((e) => e.activity_id === targetActivity.activity_id);
      const filtered = actEvents.filter((e) => (isYear ? isThisYear(e.occurred_at, baseNow) : isThisMonth(e.occurred_at, baseNow)));
      const timeframe = isYear ? 'this year' : 'this month';

      return {
        isSmartQuery: true,
        headline: `${targetActivity.name}: ${filtered.length} ${filtered.length === 1 ? 'time' : 'times'} ${timeframe}`,
        subtext: `Total recorded all-time: ${actEvents.length} events.`,
        badge: `${filtered.length} in ${timeframe}`,
        matchedActivity: targetActivity,
        matchedEvents: filtered,
        statCount: filtered.length,
      };
    }
  }

  // Pattern 3: "When did I last [activity]?" or "last [activity]"
  const isLastQuery = query.startsWith('when did') || query.startsWith('last ') || query.includes('last time') || query.includes('when was') || query.includes('when');
  const targetActivity = findActivity(query);
  if (targetActivity && (isLastQuery || query.includes(targetActivity.name.toLowerCase()) || query.split(/\W+/).length <= 4)) {
    if (targetActivity) {
      const summary = summaries.find((s) => s.activity.activity_id === targetActivity.activity_id);
      const lastEvent = summary?.lastEvent;

      if (!lastEvent) {
        return {
          isSmartQuery: true,
          headline: `No recorded events yet for "${targetActivity.name}"`,
          subtext: `You have not logged any occurrences for this activity.`,
          badge: 'Never recorded',
          matchedActivity: targetActivity,
          matchedEvents: [],
          statCount: 0,
        };
      }

      const relative = formatRelativeTime(lastEvent.occurred_at, baseNow);
      const formatted = formatDateTime(lastEvent.occurred_at);
      const totalThisMonth = events.filter((e) => e.activity_id === targetActivity.activity_id && isThisMonth(e.occurred_at, baseNow)).length;

      return {
        isSmartQuery: true,
        headline: `Last ${targetActivity.name} was ${relative}`,
        subtext: `Occurred on ${formatted}. (${totalThisMonth} times this month, ${summary?.totalOccurrences || 0} total)`,
        badge: relative,
        matchedActivity: targetActivity,
        matchedEvents: events.filter((e) => e.activity_id === targetActivity.activity_id),
        statCount: summary?.totalOccurrences,
      };
    }
  }

  return null;
}
