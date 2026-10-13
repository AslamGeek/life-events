import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Tag, FileText, Plus, Sparkles, Check } from 'lucide-react';
import { Activity } from '../types';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../utils/dateUtils';
import { COMMON_CATEGORIES } from '../utils/starterData';

interface LogEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: Activity[];
  initialActivityId?: string;
  onSaveEvent: (data: {
    activityId: string;
    activityName: string;
    occurredAt: string;
    notes?: string;
    category?: string;
    tags: string[];
    isNewActivity?: boolean;
  }) => Promise<void>;
}

export const LogEventModal: React.FC<LogEventModalProps> = ({
  isOpen,
  onClose,
  activities,
  initialActivityId,
  onSaveEvent,
}) => {
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [isCreatingNewActivity, setIsCreatingNewActivity] = useState<boolean>(false);
  const [newActivityName, setNewActivityName] = useState<string>('');
  const [category, setCategory] = useState<string>('General');
  const [occurredAtInput, setOccurredAtInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form state upon modal open
  useEffect(() => {
    if (isOpen) {
      setOccurredAtInput(toDatetimeLocalValue(new Date()));
      setNotes('');
      setTagInput('');
      setErrorMessage(null);
      setIsSubmitting(false);

      if (initialActivityId) {
        const found = activities.find((a) => a.activity_id === initialActivityId);
        if (found) {
          setSelectedActivityId(found.activity_id);
          setIsCreatingNewActivity(false);
          setCategory(found.category || 'General');
          setTags(found.tags || []);
          return;
        }
      }

      if (activities.length > 0) {
        setSelectedActivityId(activities[0].activity_id);
        setIsCreatingNewActivity(false);
        setCategory(activities[0].category || 'General');
        setTags(activities[0].tags || []);
      } else {
        setIsCreatingNewActivity(true);
        setSelectedActivityId('');
        setNewActivityName('');
        setCategory('General');
        setTags([]);
      }
    }
  }, [isOpen, initialActivityId, activities]);

  // Update category and default tags when selected activity changes
  const handleSelectActivity = (id: string) => {
    setSelectedActivityId(id);
    setIsCreatingNewActivity(false);
    const act = activities.find((a) => a.activity_id === id);
    if (act) {
      setCategory(act.category || 'General');
      setTags([...act.tags]);
    }
  };

  // Quick preset time helpers
  const applyTimePreset = (preset: 'now' | '1h_ago' | 'morning' | 'yesterday' | '2d_ago') => {
    const now = new Date();
    if (preset === 'now') {
      setOccurredAtInput(toDatetimeLocalValue(now));
    } else if (preset === '1h_ago') {
      const d = new Date(now.getTime() - 60 * 60 * 1000);
      setOccurredAtInput(toDatetimeLocalValue(d));
    } else if (preset === 'morning') {
      const d = new Date(now);
      d.setHours(9, 0, 0, 0);
      setOccurredAtInput(toDatetimeLocalValue(d));
    } else if (preset === 'yesterday') {
      const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setOccurredAtInput(toDatetimeLocalValue(d));
    } else if (preset === '2d_ago') {
      const d = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      setOccurredAtInput(toDatetimeLocalValue(d));
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let finalActivityId = selectedActivityId;
    let finalActivityName = '';

    if (isCreatingNewActivity) {
      const trimmed = newActivityName.trim();
      if (!trimmed) {
        setErrorMessage('Please enter an activity name.');
        return;
      }
      finalActivityName = trimmed;
      finalActivityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    } else {
      const act = activities.find((a) => a.activity_id === selectedActivityId);
      if (!act) {
        setErrorMessage('Please choose a valid activity.');
        return;
      }
      finalActivityName = act.name;
    }

    if (!occurredAtInput) {
      setErrorMessage('Please provide the date and time when this occurred.');
      return;
    }

    const isoOccurredAt = fromDatetimeLocalValue(occurredAtInput);

    try {
      setIsSubmitting(true);
      await onSaveEvent({
        activityId: finalActivityId,
        activityName: finalActivityName,
        occurredAt: isoOccurredAt,
        notes: notes.trim() || undefined,
        category: category.trim() || undefined,
        tags,
        isNewActivity: isCreatingNewActivity,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to log event:', err);
      setErrorMessage(err.message || 'Failed to save event to Google Sheets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl text-stone-100 my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Log Life Event</h2>
              <p className="text-xs text-stone-400">Record a new occurrence in seconds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Activity Selection or Creation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-300">
                Activity <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewActivity(!isCreatingNewActivity);
                  setErrorMessage(null);
                }}
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
              >
                {isCreatingNewActivity ? 'Select existing activity' : '+ New custom activity'}
              </button>
            </div>

            {isCreatingNewActivity ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g., Beard Cut, Laundry, Service Car, Walk Dog"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-stone-950 border border-emerald-700/80 rounded-xl text-sm text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-stone-400">
                  This new activity will automatically be added to your Activities sheet.
                </p>
              </div>
            ) : (
              <select
                value={selectedActivityId}
                onChange={(e) => handleSelectActivity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {activities
                  .filter((a) => !a.archived)
                  .map((act) => (
                    <option key={act.activity_id} value={act.activity_id}>
                      {act.name} {act.category ? `(${act.category})` : ''}
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Occurred At Date & Time */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>When did it happen?</span>
              </label>
            </div>

            <input
              type="datetime-local"
              value={occurredAtInput}
              onChange={(e) => setOccurredAtInput(e.target.value)}
              required
              className="w-full px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />

            {/* Quick time presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => applyTimePreset('now')}
                className="px-2 py-1 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors"
              >
                Right now
              </button>
              <button
                type="button"
                onClick={() => applyTimePreset('1h_ago')}
                className="px-2 py-1 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors"
              >
                1h ago
              </button>
              <button
                type="button"
                onClick={() => applyTimePreset('morning')}
                className="px-2 py-1 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors"
              >
                Earlier today (9 AM)
              </button>
              <button
                type="button"
                onClick={() => applyTimePreset('yesterday')}
                className="px-2 py-1 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => applyTimePreset('2d_ago')}
                className="px-2 py-1 text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg transition-colors"
              >
                2 days ago
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1.5">Category</label>
              <input
                type="text"
                list="category-suggestions"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="category-suggestions">
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-stone-400" />
                <span>Tags</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. quick, salon"
                  className="flex-1 px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-2.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-xl"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Tags list */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-xs rounded-lg"
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

          {/* Optional Notes */}
          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-stone-400" />
              <span>Notes (optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Trimmed beard to 4mm with guard #2; cleaned clippers."
              className="w-full px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sm text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-stone-950/40 border-t-stone-950 rounded-full animate-spin" />
                  <span>Saving to Sheets...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
