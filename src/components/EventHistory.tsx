import React, { useState, useMemo } from 'react';
import {
  History as HistoryIcon,
  Search,
  Filter,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Tag,
  ArrowUpDown,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Activity, LifeEvent } from '../types';
import {
  formatRelativeTime,
  formatDateTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from '../utils/dateUtils';
import { ConfirmationModal } from './ConfirmationModal';

interface EventHistoryProps {
  events: LifeEvent[];
  activities: Activity[];
  initialFilterActivityId?: string;
  onUpdateEvent: (event: LifeEvent) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onNavigateToDashboard: () => void;
  onOpenLogModal: (activityId?: string) => void;
}

export const EventHistory: React.FC<EventHistoryProps> = ({
  events,
  activities,
  initialFilterActivityId,
  onUpdateEvent,
  onDeleteEvent,
  onNavigateToDashboard,
  onOpenLogModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState<string>(
    initialFilterActivityId || 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<
    'all' | 'today' | 'week' | 'month' | 'year'
  >('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Edit event modal state
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
  const [editOccurredAt, setEditOccurredAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete event confirmation modal state
  const [deletingEvent, setDeletingEvent] = useState<LifeEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [activities]);

  // Filtered and sorted events
  const filteredEvents = useMemo(() => {
    const now = new Date();

    return events
      .filter((evt) => {
        // Activity filter
        if (selectedActivityId !== 'all' && evt.activity_id !== selectedActivityId) {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'all') {
          const act = activities.find((a) => a.activity_id === evt.activity_id);
          if (act?.category !== selectedCategory) return false;
        }

        // Date range filter
        if (selectedDateRange !== 'all') {
          const evtDate = new Date(evt.occurred_at);
          if (selectedDateRange === 'today') {
            if (
              evtDate.getFullYear() !== now.getFullYear() ||
              evtDate.getMonth() !== now.getMonth() ||
              evtDate.getDate() !== now.getDate()
            ) {
              return false;
            }
          } else if (selectedDateRange === 'week') {
            const diffDays = (now.getTime() - evtDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 7 || diffDays < 0) return false;
          } else if (selectedDateRange === 'month') {
            if (
              evtDate.getFullYear() !== now.getFullYear() ||
              evtDate.getMonth() !== now.getMonth()
            ) {
              return false;
            }
          } else if (selectedDateRange === 'year') {
            if (evtDate.getFullYear() !== now.getFullYear()) return false;
          }
        }

        // Search text
        if (search.trim()) {
          const query = search.toLowerCase();
          const matchesName = evt.activity_name.toLowerCase().includes(query);
          const matchesNotes = evt.notes?.toLowerCase().includes(query) || false;
          const matchesTags = evt.tags.some((t) => t.toLowerCase().includes(query));
          if (!matchesName && !matchesNotes && !matchesTags) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.occurred_at).getTime();
        const timeB = new Date(b.occurred_at).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [events, activities, selectedActivityId, selectedCategory, selectedDateRange, search, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEvents, currentPage]);

  const openEditModal = (evt: LifeEvent) => {
    setEditingEvent(evt);
    setEditOccurredAt(toDatetimeLocalValue(new Date(evt.occurred_at)));
    setEditNotes(evt.notes || '');
    setEditTags([...evt.tags]);
    setEditTagInput('');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    if (!editOccurredAt) {
      setEditError('Please select a valid occurred date and time.');
      return;
    }

    try {
      setIsSavingEdit(true);
      const updated: LifeEvent = {
        ...editingEvent,
        occurred_at: fromDatetimeLocalValue(editOccurredAt),
        notes: editNotes.trim() || undefined,
        tags: editTags,
        updated_at: new Date().toISOString(),
      };
      await onUpdateEvent(updated);
      setEditingEvent(null);
    } catch (err: any) {
      console.error('Failed to update event:', err);
      setEditError(err.message || 'Failed to update event in Google Sheets.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;
    try {
      setIsDeleting(true);
      await onDeleteEvent(deletingEvent.event_id);
      setDeletingEvent(null);
    } catch (err: any) {
      console.error('Failed to delete event:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-emerald-400" />
            <span>Event History</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Searchable, chronological log of all life activities with full details.
          </p>
        </div>

        <button
          onClick={() => onOpenLogModal(selectedActivityId !== 'all' ? selectedActivityId : undefined)}
          className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          + Log Another Event
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search activity name, notes, or tags..."
              className="w-full pl-10 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Activity Dropdown */}
          <select
            value={selectedActivityId}
            onChange={(e) => {
              setSelectedActivityId(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Activities</option>
            {activities.map((a) => (
              <option key={a.activity_id} value={a.activity_id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Date Range Dropdown */}
          <select
            value={selectedDateRange}
            onChange={(e) => {
              setSelectedDateRange(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-950 border border-stone-800 hover:border-stone-700 text-xs text-stone-300 rounded-xl transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}</span>
          </button>
        </div>

        {/* Filter Count & Reset */}
        <div className="flex items-center justify-between text-xs text-stone-400 pt-1 border-t border-stone-800/60">
          <span>
            Showing <strong className="text-white">{filteredEvents.length}</strong> recorded{' '}
            {filteredEvents.length === 1 ? 'event' : 'events'}
          </span>
          {(search ||
            selectedActivityId !== 'all' ||
            selectedCategory !== 'all' ||
            selectedDateRange !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedActivityId('all');
                setSelectedCategory('all');
                setSelectedDateRange('all');
                setCurrentPage(1);
              }}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Events List / Timeline */}
      <div className="space-y-3">
        {paginatedEvents.length === 0 ? (
          <div className="p-12 text-center bg-stone-900/40 border border-dashed border-stone-800 rounded-2xl text-xs text-stone-500 space-y-2">
            <p>No recorded events found matching your criteria.</p>
            <button
              onClick={() => onOpenLogModal()}
              className="text-emerald-400 hover:underline font-semibold"
            >
              Log an event now
            </button>
          </div>
        ) : (
          paginatedEvents.map((evt) => {
            const activity = activities.find((a) => a.activity_id === evt.activity_id);
            return (
              <div
                key={evt.event_id}
                className="bg-stone-900/90 border border-stone-800 hover:border-stone-700/80 rounded-2xl p-4 sm:p-5 shadow-sm transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white tracking-tight">
                      {evt.activity_name}
                    </span>
                    {activity?.category && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-stone-800 text-stone-300 rounded-md">
                        {activity.category}
                      </span>
                    )}
                  </div>

                  {/* Relative Elapsed Time Badge */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-xl">
                      {formatRelativeTime(evt.occurred_at)}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 pl-2">
                      <button
                        onClick={() => openEditModal(evt)}
                        title="Edit event"
                        className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingEvent(evt)}
                        title="Delete event"
                        className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timestamps Row: Both Occurred At and Recorded At */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-400 bg-stone-950/50 p-2.5 rounded-xl border border-stone-800/80">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Occurred: </span>
                    <strong className="text-stone-200">{formatDateTime(evt.occurred_at)}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Logged at: </span>
                    <span className="text-stone-400">{formatDateTime(evt.recorded_at)}</span>
                  </div>
                </div>

                {/* Notes */}
                {evt.notes && (
                  <div className="flex items-start gap-2 text-xs text-stone-300 bg-stone-950/40 p-3 rounded-xl border border-stone-800/60">
                    <FileText className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                    <p className="whitespace-pre-line leading-relaxed">{evt.notes}</p>
                  </div>
                )}

                {/* Tags */}
                {evt.tags && evt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {evt.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 text-[10px] bg-stone-800/90 text-stone-400 rounded-md"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-stone-900/60 border border-stone-800 rounded-2xl text-xs text-stone-400">
          <span>
            Page <strong className="text-white">{currentPage}</strong> of{' '}
            <strong className="text-white">{totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl text-stone-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
              <h2 className="text-sm font-semibold text-white">
                Edit Event: {editingEvent.activity_name}
              </h2>
              <button
                onClick={() => setEditingEvent(null)}
                disabled={isSavingEdit}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                  {editError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">
                  Occurred Date & Time <span className="text-rose-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={editOccurredAt}
                  onChange={(e) => setEditOccurredAt(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">Notes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes about this event..."
                  className="w-full px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = editTagInput.trim().toLowerCase();
                        if (val && !editTags.includes(val)) {
                          setEditTags([...editTags, val]);
                          setEditTagInput('');
                        }
                      }
                    }}
                    placeholder="Add tag..."
                    className="flex-1 px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = editTagInput.trim().toLowerCase();
                      if (val && !editTags.includes(val)) {
                        setEditTags([...editTags, val]);
                        setEditTagInput('');
                      }
                    }}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl"
                  >
                    Add
                  </button>
                </div>

                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs rounded-lg"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => setEditTags(editTags.filter((x) => x !== t))}
                          className="hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isSavingEdit ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-stone-950/40 border-t-stone-950 rounded-full animate-spin" />
                      <span>Updating Sheets...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Required for destructive Workspace operations) */}
      <ConfirmationModal
        isOpen={Boolean(deletingEvent)}
        title="Delete Event Record"
        message={`Are you sure you want to permanently delete this event for "${deletingEvent?.activity_name}" on ${
          deletingEvent ? formatDateTime(deletingEvent.occurred_at) : ''
        }?\n\nThis will remove the corresponding row from your Google Spreadsheet. This action cannot be undone.`}
        confirmLabel="Delete Event"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingEvent(null)}
      />
    </div>
  );
};
