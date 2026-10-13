import React from 'react';
import { User } from 'firebase/auth';
import {
  CalendarCheck,
  RefreshCw,
  ExternalLink,
  Plus,
  LayoutDashboard,
  History,
  FolderKanban,
  Settings,
  LogOut,
  FileSpreadsheet,
} from 'lucide-react';
import { ViewTab, SyncStatus } from '../types';
import { formatRelativeTime } from '../utils/dateUtils';

interface HeaderProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  onOpenLogModal: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  syncStatus: SyncStatus;
  onManualSync: () => void;
  isAuthenticating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenLogModal,
  user,
  onSignIn,
  onSignOut,
  syncStatus,
  onManualSync,
  isAuthenticating,
}) => {
  const spreadsheetUrl = syncStatus.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${syncStatus.spreadsheetId}/edit`
    : null;

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-950/40">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">LifeLog</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-full">
                  Sheets Sync
                </span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block">
                Personal Life Event Tracker
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-950/60 p-1 rounded-xl border border-stone-800/80">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => onTabChange('history')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'history'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History
            </button>
            <button
              onClick={() => onTabChange('activities')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'activities'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              Activities
            </button>
            <button
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentTab === 'settings'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Log Action */}
            <button
              onClick={onOpenLogModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl transition-all shadow-md shadow-emerald-950/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Log Event</span>
            </button>

            {/* Sync status indicator */}
            {user && (
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-stone-950/70 border border-stone-800/80 text-[11px]">
                <button
                  onClick={onManualSync}
                  disabled={syncStatus.state === 'syncing'}
                  title="Click to force sync with Google Sheets"
                  className="flex items-center gap-1.5 text-stone-300 hover:text-white transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      syncStatus.state === 'syncing'
                        ? 'animate-spin text-emerald-400'
                        : syncStatus.state === 'error'
                        ? 'text-rose-400'
                        : 'text-stone-400'
                    }`}
                  />
                  <span>
                    {syncStatus.state === 'syncing'
                      ? 'Syncing...'
                      : syncStatus.state === 'error'
                      ? 'Sync error'
                      : syncStatus.lastSyncedAt
                      ? `Synced ${formatRelativeTime(syncStatus.lastSyncedAt)}`
                      : 'Not synced'}
                  </span>
                </button>

                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open spreadsheet in Google Sheets"
                    className="p-1 text-emerald-400 hover:text-emerald-300 rounded hover:bg-stone-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* User Auth Profile / Login Button */}
            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <div
                  className="flex items-center gap-2 p-1 pl-2 bg-stone-950/80 border border-stone-800 rounded-xl text-xs"
                  title={`Signed in as ${user.email}`}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-lg object-cover border border-stone-700"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-[10px]">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="hidden xl:inline text-stone-300 max-w-[100px] truncate text-xs">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <button
                    onClick={onSignOut}
                    title="Sign Out"
                    className="p-1 text-stone-400 hover:text-rose-400 hover:bg-stone-800/80 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                disabled={isAuthenticating}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white text-stone-900 hover:bg-stone-100 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isAuthenticating ? 'Connecting...' : 'Connect Sheets'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-stone-800/70 text-xs">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
              currentTab === 'dashboard' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onTabChange('history')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
              currentTab === 'history' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </button>
          <button
            onClick={() => onTabChange('activities')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
              currentTab === 'activities' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Activities</span>
          </button>
          <button
            onClick={() => onTabChange('settings')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg ${
              currentTab === 'settings' ? 'text-emerald-400 font-semibold' : 'text-stone-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
