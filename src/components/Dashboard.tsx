import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Sparkles,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Zap,
  Tag,
  FileText,
} from 'lucide-react';
import { Activity, LifeEvent, ActivitySummary } from '../types';
import { formatRelativeTime, formatDateTime } from '../utils/dateUtils';
import { parseSmartQuery, QueryResult } from '../utils/searchParser';

interface DashboardProps {
  activities: Activity[];
  events: LifeEvent[];
  summaries: ActivitySummary[];
  onOpenLogModal: (activityId?: string) => void;
  onNavigateToHistory: (activityId?: string) => void;
  onQuickLogNow: (activity: Activity) => Promise<void>;
  onOpenSettings: () => void;
  onSeedStarterActivities: () => Promise<void>;
  isAuthenticated: boolean;
  onSignIn: () => void;
  isSyncing: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activities,
  events,
  summaries,
  onOpenLogModal,
  onNavigateToHistory,
  onQuickLogNow,
  onOpenSettings,
  onSeedStarterActivities,
  isAuthenticated,
  onSignIn,
  isSyncing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [quickLoggingId, setQuickLoggingId] = useState<string | null>(null);

  // Parse smart queries deterministically
  const queryResult: QueryResult | null = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return parseSmartQuery(searchQuery, activities, events, summaries);
  }, [searchQuery, activities, events, summaries]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const now = new Date();
    const eventsThisMonth = events.filter((e) => {
      const d = new Date(e.occurred_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    const overdueCount = summaries.filter((s) => s.isOverdue && !s.activity.archived).length;
    const activeActivitiesCount = activities.filter((a) => !a.archived).length;

    return { totalEvents, eventsThisMonth, overdueCount, activeActivitiesCount };
  }, [events, summaries, activities]);

  // Top frequently used activities for 1-tap shortcuts
  const frequentActivities = useMemo(() => {
    return [...summaries]
      .filter((s) => !s.activity.archived)
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
      .slice(0, 6);
  }, [summaries]);

  // Handle 1-tap quick logging
  const handleQuickLog = async (activity: Activity) => {
    setQuickLoggingId(activity.activity_id);
    try {
      await onQuickLogNow(activity);
    } finally {
      setQuickLoggingId(null);
    }
  };

  const sampleQuestions = [
    'When did I last cut my beard?',
    'When did I last wash my clothes?',
    'How many times did I walk in the park this month?',
    'Which activities have not happened in 30 days?',
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Google Sheets Connection Notice if not signed in */}
      {!isAuthenticated && (
        <div className="bg-gradient-to-r from-emerald-950/80 via-stone-900 to-stone-900 border border-emerald-800/80 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-200 text-sm">
                Connect your Google Account to persist events in Google Sheets
              </h3>
              <p className="text-xs text-stone-300 mt-0.5">
                All activities and events are stored securely in your private Google Spreadsheet.
              </p>
            </div>
          </div>
          <button
            onClick={onSignIn}
            className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Connect Sheets Now</span>
          </button>
        </div>
      )}

      {/* Hero Quick Add & Search Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Life Event Tracker
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Log everyday personal routines and query exact timelines anytime.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenLogModal()}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-lg shadow-emerald-950/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Quick Log Event</span>
          </button>
        </div>
      </div>

      {/* Smart Query & Natural Language Search Bar */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask anything: When did I last cut my beard? or not happened in 30 days..."
            className="w-full pl-10 pr-10 py-3 bg-stone-950/80 border border-stone-700/80 rounded-xl text-sm text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Suggested Queries Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-stone-400 font-medium">Try asking:</span>
          {sampleQuestions.map((q) => (
            <button
              key={q}
              onClick={() => setSearchQuery(q)}
              className="px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-[11px] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Deterministic Smart Query Answer Card */}
        {queryResult && (
          <div className="mt-3 p-4 bg-emerald-950/70 border border-emerald-700/80 rounded-xl animate-in fade-in space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-stone-950 rounded-md">
                    Instant Answer
                  </span>
                  {queryResult.badge && (
                    <span className="text-xs font-semibold text-emerald-300">
                      • {queryResult.badge}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  {queryResult.headline}
                </h4>
                {queryResult.subtext && (
                  <p className="text-xs text-stone-300">{queryResult.subtext}</p>
                )}
              </div>

              {queryResult.matchedActivity && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenLogModal(queryResult.matchedActivity?.activity_id)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-semibold rounded-lg transition-all"
                  >
                    Log Again
                  </button>
                  <button
                    onClick={() =>
                      onNavigateToHistory(queryResult.matchedActivity?.activity_id)
                    }
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-lg transition-all"
                  >
                    View History
                  </button>
                </div>
              )}
            </div>

            {/* If matched activities list (e.g. inactive) */}
            {queryResult.matchedActivities && queryResult.matchedActivities.length > 0 && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {queryResult.matchedActivities.map((act) => (
                  <div
                    key={act.activity_id}
                    className="p-2.5 bg-stone-900/80 rounded-lg border border-stone-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-stone-200">{act.name}</span>
                    <button
                      onClick={() => onOpenLogModal(act.activity_id)}
                      className="text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold"
                    >
                      Log Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
            <span>Total Events</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.totalEvents}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Recorded all-time</div>
        </div>

        <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
            <span>This Month</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.eventsThisMonth}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Events logged this month</div>
        </div>

        <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
            <span>Overdue Reminders</span>
            <AlertCircle
              className={`w-4 h-4 ${stats.overdueCount > 0 ? 'text-rose-400' : 'text-stone-500'}`}
            />
          </div>
          <div
            className={`text-2xl font-bold mt-2 ${
              stats.overdueCount > 0 ? 'text-rose-400' : 'text-stone-200'
            }`}
          >
            {stats.overdueCount}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">Activities needing attention</div>
        </div>

        <div className="p-4 bg-stone-900/80 border border-stone-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
            <span>Tracked Activities</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.activeActivitiesCount}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Active routine types</div>
        </div>
      </div>

      {/* Empty State / Seed Starter Activities Option */}
      {activities.length === 0 && (
        <div className="p-8 bg-stone-900/70 border border-dashed border-stone-700 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Zap className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">Your Activity Library is Empty</h3>
            <p className="text-xs text-stone-400 mt-1">
              You can start fresh or quickly populate standard life activities like beard cut,
              laundry, car service, bedsheets, and watering plants.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onSeedStarterActivities}
              className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Starter Activities</span>
            </button>
            <button
              onClick={() => onOpenLogModal()}
              className="px-4 py-2 text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl transition-all"
            >
              Create First Custom Activity
            </button>
          </div>
        </div>
      )}

      {/* Quick 1-Tap Log Shortcuts */}
      {frequentActivities.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Frequently Used Activities (1-Tap Log)</span>
              </h2>
            </div>
            <span className="text-xs text-stone-500">Tap to record immediately</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {frequentActivities.map(({ activity, lastEvent, isOverdue }) => {
              const isLogging = quickLoggingId === activity.activity_id;
              return (
                <div
                  key={activity.activity_id}
                  className={`p-3.5 bg-stone-900/90 border rounded-2xl transition-all flex items-center justify-between gap-3 ${
                    isOverdue
                      ? 'border-rose-900/80 bg-rose-950/20'
                      : 'border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => onNavigateToHistory(activity.activity_id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">
                        {activity.name}
                      </span>
                      {activity.category && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-stone-800 text-stone-300 rounded">
                          {activity.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-1">
                      <Clock className="w-3.5 h-3.5 text-stone-500" />
                      <span>
                        {lastEvent ? formatRelativeTime(lastEvent.occurred_at) : 'Never logged'}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] text-rose-400 font-semibold ml-1">
                          (Overdue)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuickLog(activity)}
                    disabled={isLogging}
                    className="px-3 py-1.5 text-xs font-semibold bg-stone-800 hover:bg-emerald-600 text-stone-200 hover:text-white rounded-xl transition-all shrink-0 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isLogging ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Grid: Tracked Activities (Latest Occurrence) & Recent Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Tracked Activities with Elapsed Time (7 cols) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Tracked Activities & Latest Occurrence</span>
            </h2>
            <span className="text-xs text-stone-500">{summaries.length} total</span>
          </div>

          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl divide-y divide-stone-800/80 overflow-hidden shadow-lg">
            {summaries.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500">
                No activities defined yet.
              </div>
            ) : (
              summaries
                .filter((s) => !s.activity.archived)
                .map((summary) => {
                  const { activity, lastEvent, isOverdue, daysOverdue, totalOccurrences } = summary;
                  return (
                    <div
                      key={activity.activity_id}
                      className="p-4 hover:bg-stone-800/40 transition-colors flex items-center justify-between gap-4"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => onNavigateToHistory(activity.activity_id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-stone-100">
                            {activity.name}
                          </span>
                          {activity.category && (
                            <span className="px-2 py-0.5 text-[10px] bg-stone-800 text-stone-300 rounded-md">
                              {activity.category}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800 rounded-md">
                              {daysOverdue ? `${daysOverdue}d overdue` : 'Overdue'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400 mt-1.5">
                          <span className="flex items-center gap-1 text-stone-300">
                            <Clock className="w-3.5 h-3.5 text-stone-500" />
                            {lastEvent
                              ? `Last: ${formatRelativeTime(lastEvent.occurred_at)}`
                              : 'Never recorded'}
                          </span>
                          {lastEvent && (
                            <span className="text-[11px] text-stone-500">
                              ({formatDateTime(lastEvent.occurred_at)})
                            </span>
                          )}
                          <span className="text-stone-500">• {totalOccurrences} total logs</span>
                          {activity.reminder_interval_days && (
                            <span className="text-stone-500">
                              • Interval: {activity.reminder_interval_days}d
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onOpenLogModal(activity.activity_id)}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-stone-950 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Log</span>
                        </button>
                        <button
                          onClick={() => onNavigateToHistory(activity.activity_id)}
                          title="View complete history"
                          className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>

        {/* Right Column: Recently Recorded Events Timeline (5 cols) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>Recently Recorded Events</span>
            </h2>
            <button
              onClick={() => onNavigateToHistory()}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              View all ({events.length})
            </button>
          </div>

          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl divide-y divide-stone-800/80 overflow-hidden shadow-lg">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500 space-y-2">
                <p>No events logged yet.</p>
                <button
                  onClick={() => onOpenLogModal()}
                  className="text-xs text-emerald-400 hover:underline font-semibold"
                >
                  Log your first event now
                </button>
              </div>
            ) : (
              events.slice(0, 6).map((evt) => (
                <div
                  key={evt.event_id}
                  onClick={() => onNavigateToHistory(evt.activity_id)}
                  className="p-4 hover:bg-stone-800/40 transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-stone-100">
                      {evt.activity_name}
                    </span>
                    <span className="text-[11px] text-stone-400 font-medium shrink-0">
                      {formatRelativeTime(evt.occurred_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <Clock className="w-3.5 h-3.5 text-stone-500" />
                    <span>Occurred: {formatDateTime(evt.occurred_at)}</span>
                  </div>

                  {evt.notes && (
                    <div className="flex items-start gap-1.5 text-xs text-stone-300 bg-stone-950/60 p-2 rounded-lg border border-stone-800/80">
                      <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{evt.notes}</span>
                    </div>
                  )}

                  {evt.tags && evt.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {evt.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 text-[10px] bg-stone-800/80 text-stone-400 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
