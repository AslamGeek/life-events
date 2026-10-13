import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  FolderKanban,
  Edit2,
  Archive,
  RotateCcw,
  Clock,
  History,
  Tag,
  Calendar,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { Activity, ActivitySummary } from '../types';
import { formatRelativeTime, formatDateTime } from '../utils/dateUtils';
import { COMMON_CATEGORIES } from '../utils/starterData';
import { ConfirmationModal } from './ConfirmationModal';

interface ActivityLibraryProps {
  activities: Activity[];
  summaries: ActivitySummary[];
  onSaveActivity: (activity: Activity) => Promise<void>;
  onNavigateToHistory: (activityId: string) => void;
  onOpenLogModal: (activityId: string) => void;
}

export const ActivityLibrary: React.FC<ActivityLibraryProps> = ({
  activities,
  summaries,
  onSaveActivity,
  onNavigateToHistory,
  onOpenLogModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Edit / Create modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalCategory, setModalCategory] = useState('General');
  const [modalReminderDays, setModalReminderDays] = useState<string>('');
  const [modalTagInput, setModalTagInput] = useState('');
  const [modalTags, setModalTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Archive confirmation modal state
  const [archiveTarget, setArchiveTarget] = useState<Activity | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Extract all available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [activities]);

  // Filtered list
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (act.archived !== showArchived) return false;
      if (selectedCategory !== 'all' && act.category !== selectedCategory) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = act.name.toLowerCase().includes(query);
        const matchesCat = act.category.toLowerCase().includes(query);
        const matchesTags = act.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesName && !matchesCat && !matchesTags) return false;
      }
      return true;
    });
  }, [activities, showArchived, selectedCategory, search]);

  const openCreateModal = () => {
    setEditingActivity(null);
    setModalName('');
    setModalCategory('General');
    setModalReminderDays('14');
    setModalTags([]);
    setModalTagInput('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (activity: Activity) => {
    setEditingActivity(activity);
    setModalName(activity.name);
    setModalCategory(activity.category || 'General');
    setModalReminderDays(
      activity.reminder_interval_days !== null ? String(activity.reminder_interval_days) : ''
    );
    setModalTags([...activity.tags]);
    setModalTagInput('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleAddTag = () => {
    const trimmed = modalTagInput.trim().toLowerCase();
    if (trimmed && !modalTags.includes(trimmed)) {
      setModalTags([...modalTags, trimmed]);
      setModalTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setModalTags(modalTags.filter((t) => t !== tag));
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = modalName.trim();
    if (!trimmedName) {
      setModalError('Please enter an activity name.');
      return;
    }

    const interval = modalReminderDays ? parseInt(modalReminderDays, 10) : null;
    const nowIso = new Date().toISOString();

    const activityToSave: Activity = editingActivity
      ? {
          ...editingActivity,
          name: trimmedName,
          category: modalCategory.trim() || 'General',
          reminder_interval_days: isNaN(interval as number) ? null : interval,
          tags: modalTags,
          updated_at: nowIso,
        }
      : {
          activity_id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: trimmedName,
          category: modalCategory.trim() || 'General',
          reminder_interval_days: isNaN(interval as number) ? null : interval,
          tags: modalTags,
          created_at: nowIso,
          updated_at: nowIso,
          archived: false,
        };

    try {
      setIsSaving(true);
      await onSaveActivity(activityToSave);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save activity:', err);
      setModalError(err.message || 'Failed to save activity.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle archive
  const handleConfirmArchiveToggle = async () => {
    if (!archiveTarget) return;
    try {
      setIsArchiving(true);
      const updated: Activity = {
        ...archiveTarget,
        archived: !archiveTarget.archived,
        updated_at: new Date().toISOString(),
      };
      await onSaveActivity(updated);
      setArchiveTarget(null);
    } catch (err: any) {
      console.error('Failed to update archive status:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-emerald-400" />
            <span>Activity Library</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Manage your tracked routines, rename items, set reminder cycles, and archive.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Activity</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities or tags..."
              className="w-full pl-10 pr-4 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                showArchived
                  ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {showArchived ? 'Showing Archived' : 'Show Archived'}
            </button>
          </div>
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredActivities.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-stone-900/40 border border-dashed border-stone-800 rounded-2xl text-xs text-stone-500">
            No activities match your search or filter.
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const summary = summaries.find((s) => s.activity.activity_id === activity.activity_id);
            const lastOccurred = summary?.lastEvent?.occurred_at;

            return (
              <div
                key={activity.activity_id}
                className="bg-stone-900/90 border border-stone-800 hover:border-stone-700/80 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base text-white tracking-tight">
                        {activity.name}
                      </h3>
                      {activity.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium bg-stone-800 text-stone-300 rounded-md">
                          {activity.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(activity)}
                        title="Edit / Rename activity"
                        className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setArchiveTarget(activity)}
                        title={activity.archived ? 'Unarchive activity' : 'Archive activity'}
                        className="p-1.5 text-stone-400 hover:text-amber-400 hover:bg-stone-800 rounded-lg transition-colors"
                      >
                        {activity.archived ? (
                          <RotateCcw className="w-3.5 h-3.5" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Summary / History Details */}
                  <div className="space-y-1.5 text-xs text-stone-400 bg-stone-950/60 p-3 rounded-xl border border-stone-800/80">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-stone-400">
                        <Clock className="w-3.5 h-3.5 text-stone-500" />
                        <span>Last occurred:</span>
                      </span>
                      <span className="font-medium text-stone-200">
                        {lastOccurred ? formatRelativeTime(lastOccurred) : 'Never'}
                      </span>
                    </div>

                    {lastOccurred && (
                      <div className="text-[11px] text-stone-500 text-right">
                        {formatDateTime(lastOccurred)}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-stone-800/60">
                      <span>Total times recorded:</span>
                      <span className="font-semibold text-emerald-400">
                        {summary?.totalOccurrences || 0}
                      </span>
                    </div>

                    {activity.reminder_interval_days && (
                      <div className="flex items-center justify-between">
                        <span>Reminder frequency:</span>
                        <span className="text-stone-300">
                          Every {activity.reminder_interval_days} days
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {activity.tags && activity.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {activity.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 text-[10px] bg-stone-800 text-stone-400 rounded-md"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card footer actions */}
                <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onNavigateToHistory(activity.activity_id)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-stone-300 hover:text-white bg-stone-800/80 hover:bg-stone-800 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>View History</span>
                  </button>

                  <button
                    onClick={() => onOpenLogModal(activity.activity_id)}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit / Create Activity Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl text-stone-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
              <h2 className="text-sm font-semibold text-white">
                {editingActivity ? 'Edit Activity' : 'Create New Activity'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl">
                  {modalError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">
                  Activity Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. Cut Beard, Laundry, Service Car"
                  required
                  autoFocus
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                {editingActivity && (
                  <p className="text-[11px] text-stone-400 mt-1">
                    Renaming preserves historical event associations via unique activity ID.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">Category</label>
                <input
                  type="text"
                  list="activity-categories-list"
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  placeholder="e.g. Grooming, Chores"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="activity-categories-list">
                  {COMMON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5">
                  Reminder Interval (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={modalReminderDays}
                  onChange={(e) => setModalReminderDays(e.target.value)}
                  placeholder="e.g. 14 (leave blank for none)"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  How many days between occurrences before it flags as overdue.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-300 block mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-stone-400" />
                  <span>Tags</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modalTagInput}
                    onChange={(e) => setModalTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="e.g. personal, routine"
                    className="flex-1 px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl"
                  >
                    Add
                  </button>
                </div>

                {modalTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {modalTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs rounded-lg"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
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
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-stone-950/40 border-t-stone-950 rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{editingActivity ? 'Update Activity' : 'Create Activity'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Archiving */}
      <ConfirmationModal
        isOpen={Boolean(archiveTarget)}
        title={archiveTarget?.archived ? 'Unarchive Activity' : 'Archive Activity'}
        message={
          archiveTarget?.archived
            ? `Restore "${archiveTarget?.name}" to your active activity library?`
            : `Archive "${archiveTarget?.name}"?\n\nHistorical event logs will NOT be deleted and will remain visible in your timeline.`
        }
        confirmLabel={archiveTarget?.archived ? 'Unarchive' : 'Archive'}
        isDestructive={!archiveTarget?.archived}
        isLoading={isArchiving}
        onConfirm={handleConfirmArchiveToggle}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
};
