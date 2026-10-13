import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Plus,
  Key,
  Database,
  Download,
  Upload,
  Info,
  Check,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { SyncStatus, Activity, LifeEvent } from '../types';

interface SettingsModalProps {
  user: User | null;
  syncStatus: SyncStatus;
  activities: Activity[];
  events: LifeEvent[];
  onManualSync: () => Promise<void>;
  onCreateNewSpreadsheet: () => Promise<void>;
  onConnectExistingSpreadsheet: (spreadsheetId: string) => Promise<void>;
  onSeedStarterActivities: () => Promise<void>;
  onSignIn: () => void;
  onSignOut: () => void;
  onImportBackup: (data: { activities: Activity[]; events: LifeEvent[] }) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  syncStatus,
  activities,
  events,
  onManualSync,
  onCreateNewSpreadsheet,
  onConnectExistingSpreadsheet,
  onSeedStarterActivities,
  onSignIn,
  onSignOut,
  onImportBackup,
}) => {
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [isConnectingCustom, setIsConnectingCustom] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const spreadsheetUrl = syncStatus.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${syncStatus.spreadsheetId}/edit`
    : null;

  const handleCopyId = () => {
    if (!syncStatus.spreadsheetId) return;
    navigator.clipboard.writeText(syncStatus.spreadsheetId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleConnectCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);
    let id = customSheetInput.trim();

    // Check if user pasted full URL (e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit)
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      id = match[1];
    }

    if (!id) {
      setFeedbackMessage({ type: 'error', text: 'Please enter a valid spreadsheet ID or URL.' });
      return;
    }

    try {
      setIsConnectingCustom(true);
      await onConnectExistingSpreadsheet(id);
      setCustomSheetInput('');
      setFeedbackMessage({
        type: 'success',
        text: 'Successfully connected and verified spreadsheet structure!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to connect spreadsheet.',
      });
    } finally {
      setIsConnectingCustom(false);
    }
  };

  const handleCreateNew = async () => {
    setFeedbackMessage(null);
    try {
      setIsCreatingNew(true);
      await onCreateNewSpreadsheet();
      setFeedbackMessage({
        type: 'success',
        text: 'New Google Spreadsheet created with Activities and Events worksheets!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to create spreadsheet.',
      });
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleForceSync = async () => {
    setFeedbackMessage(null);
    try {
      setIsSyncing(true);
      await onManualSync();
      setFeedbackMessage({ type: 'success', text: 'Synchronization completed successfully!' });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Synchronization failed.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeed = async () => {
    setFeedbackMessage(null);
    try {
      setIsSeeding(true);
      await onSeedStarterActivities();
      setFeedbackMessage({
        type: 'success',
        text: 'Starter activities successfully added to your spreadsheet!',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to seed starter activities.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExportJson = () => {
    const data = {
      exportDate: new Date().toISOString(),
      spreadsheetId: syncStatus.spreadsheetId,
      activities,
      events,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifelog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.activities) || !Array.isArray(parsed.events)) {
          throw new Error('Invalid JSON format: missing activities or events arrays.');
        }
        await onImportBackup({
          activities: parsed.activities,
          events: parsed.events,
        });
        setFeedbackMessage({
          type: 'success',
          text: `Imported ${parsed.activities.length} activities and ${parsed.events.length} events!`,
        });
      } catch (err: any) {
        setFeedbackMessage({
          type: 'error',
          text: err.message || 'Failed to import backup.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Database className="w-6 h-6 text-emerald-400" />
          <span>Storage & Google Sheets Settings</span>
        </h1>
        <p className="text-xs text-stone-400 mt-1">
          Configure Google authentication, active spreadsheet, synchronization, and backups.
        </p>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* 1. Google Account Status */}
      <section className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" />
          <span>Google Account Connection</span>
        </h2>

        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-stone-950/60 rounded-xl border border-stone-800">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-10 h-10 rounded-xl object-cover border border-stone-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-sm">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-semibold text-sm text-white">
                  {user.displayName || 'Authorized User'}
                </div>
                <div className="text-xs text-stone-400">{user.email}</div>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 rounded-xl transition-colors self-start sm:self-auto"
            >
              Disconnect Account
            </button>
          </div>
        ) : (
          <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-medium text-sm text-stone-200">Not Connected</div>
              <p className="text-xs text-stone-400 mt-0.5">
                Sign in to allow the app to read and write your life events spreadsheet.
              </p>
            </div>
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-xs font-semibold bg-white text-stone-900 hover:bg-stone-100 rounded-xl transition-all shadow-md self-start sm:self-auto"
            >
              Sign in with Google
            </button>
          </div>
        )}
      </section>

      {/* 2. Active Google Spreadsheet */}
      <section className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Active Google Spreadsheet</span>
          </h2>

          {syncStatus.spreadsheetId && (
            <button
              onClick={handleForceSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Force Sync Now'}</span>
            </button>
          )}
        </div>

        {syncStatus.spreadsheetId ? (
          <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs text-stone-400">Spreadsheet Title:</span>
                <div className="font-semibold text-white text-sm">
                  {syncStatus.spreadsheetTitle || 'Personal Life Event Tracker'}
                </div>
              </div>

              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-950 text-emerald-300 hover:text-emerald-200 border border-emerald-800 rounded-xl transition-colors self-start sm:self-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Sheets</span>
                </a>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-800/60">
              <div className="flex items-center gap-2">
                <span>ID:</span>
                <code className="px-2 py-0.5 bg-stone-900 border border-stone-800 rounded text-stone-300 font-mono text-[11px]">
                  {syncStatus.spreadsheetId}
                </code>
                <button
                  onClick={handleCopyId}
                  className="p-1 hover:text-white"
                  title="Copy Spreadsheet ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copiedId && <span className="text-[10px] text-emerald-400">Copied!</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 text-xs text-stone-400">
            No active spreadsheet configured yet. Create a dedicated sheet below or paste an
            existing one.
          </div>
        )}

        {/* Actions to Create or Switch Sheet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Create New */}
          <div className="p-4 bg-stone-950/40 rounded-xl border border-stone-800/80 space-y-3">
            <h3 className="font-semibold text-xs text-stone-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Create Dedicated Spreadsheet</span>
            </h3>
            <p className="text-[11px] text-stone-400">
              Generates a brand new sheet in your Google Drive titled "LifeLog" pre-configured with
              Activities and Events tabs.
            </p>
            <button
              onClick={handleCreateNew}
              disabled={isCreatingNew || !user}
              className="w-full px-3 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isCreatingNew ? 'Creating in Google Drive...' : 'Create Dedicated Sheet'}
            </button>
          </div>

          {/* Connect Existing */}
          <div className="p-4 bg-stone-950/40 rounded-xl border border-stone-800/80 space-y-3">
            <h3 className="font-semibold text-xs text-stone-200 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>Connect Existing Spreadsheet</span>
            </h3>
            <form onSubmit={handleConnectCustom} className="space-y-2">
              <input
                type="text"
                value={customSheetInput}
                onChange={(e) => setCustomSheetInput(e.target.value)}
                placeholder="Paste Spreadsheet ID or full URL..."
                className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-xl text-xs text-stone-100 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isConnectingCustom || !customSheetInput.trim() || !user}
                className="w-full px-3 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {isConnectingCustom ? 'Verifying Structure...' : 'Connect Existing Sheet'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 3. Starter Activities & Tools */}
      <section className="bg-stone-900/90 border border-stone-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Starter Activities & Data Tools</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-stone-950/60 rounded-xl border border-stone-800">
          <div>
            <h3 className="text-xs font-semibold text-stone-200">Load Common Life Activities</h3>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Add popular everyday activities (Beard Cut, Laundry, Car Service, Bedsheets, Watering
              Plants, Gym) to your sheet.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-3.5 py-2 text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl transition-colors shrink-0 disabled:opacity-50"
          >
            {isSeeding ? 'Adding...' : 'Load Starter Activities'}
          </button>
        </div>

        {/* JSON Backup & Restore */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-medium text-stone-300 hover:text-white bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Backup</span>
          </button>

          <label className="px-3 py-1.5 text-xs font-medium text-stone-300 hover:text-white bg-stone-950 border border-stone-800 hover:border-stone-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Restore from JSON</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
        </div>
      </section>

      {/* 4. Google Sheets Architecture & FAQ */}
      <section className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-6 text-xs text-stone-400 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-sky-400" />
          <span>How Google Sheets Synchronization Works</span>
        </h3>
        <ul className="list-disc pl-4 space-y-1.5 leading-relaxed text-[11px]">
          <li>
            <strong>Source of Truth:</strong> Your Google Spreadsheet is the persistent database.
            LifeLog reads from and writes to it directly via the official Google Sheets API v4.
          </li>
          <li>
            <strong>Stable Unique IDs:</strong> Rows are reconciled using unique identifiers
            (<code className="text-stone-300">activity_id</code> and{' '}
            <code className="text-stone-300">event_id</code>). Renaming or sorting rows in Google
            Sheets will never break historical relationships.
          </li>
          <li>
            <strong>Manual Sheet Edits:</strong> You can edit cell values directly in Google Sheets
            anytime! Click <em>Force Sync Now</em> or reload the app to pull changes.
          </li>
          <li>
            <strong>Separate Timestamps:</strong> LifeLog stores both{' '}
            <code className="text-stone-300">occurred_at</code> (when the life event actually took
            place) and <code className="text-stone-300">recorded_at</code> (when you logged it),
            ensuring accurate historical queries.
          </li>
        </ul>
      </section>
    </div>
  );
};
