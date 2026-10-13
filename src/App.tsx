import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  setCachedAccessToken,
} from './services/firebase';
import {
  createDedicatedSpreadsheet,
  ensureSpreadsheetStructure,
  fetchAllData,
  saveActivityRow,
  batchInsertActivities,
  saveEventRow,
  deleteEventRow,
  getSpreadsheetDetails,
} from './services/sheets';
import { Activity, LifeEvent, ActivitySummary, SyncStatus, ViewTab } from './types';
import { checkReminderStatus, getDaysElapsed, isThisMonth, isThisYear } from './utils/dateUtils';
import { STARTER_ACTIVITIES } from './utils/starterData';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ActivityLibrary } from './components/ActivityLibrary';
import { EventHistory } from './components/EventHistory';
import { SettingsModal } from './components/SettingsModal';
import { LogEventModal } from './components/LogEventModal';
import { ToastContainer, ToastMessage } from './components/Toast';

const LOCAL_STORAGE_SHEET_KEY = 'lifelog_spreadsheet_id';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncedAt: null,
    spreadsheetId: localStorage.getItem(LOCAL_STORAGE_SHEET_KEY) || undefined,
  });

  // Modal states
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logModalInitialActivityId, setLogModalInitialActivityId] = useState<string | undefined>();
  const [historyFilterActivityId, setHistoryFilterActivityId] = useState<string | undefined>();

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string, title?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      setToasts((prev) => [...prev, { id, type, message, title }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Compute activity summaries
  const summaries: ActivitySummary[] = useMemo(() => {
    const now = new Date();
    return activities.map((activity) => {
      // Find all events for this activity
      const actEvents = events.filter((e) => e.activity_id === activity.activity_id);

      // Latest event based strictly on occurred_at
      let lastEvent: LifeEvent | null = null;
      if (actEvents.length > 0) {
        lastEvent = [...actEvents].sort(
          (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        )[0];
      }

      const daysAgo = lastEvent ? getDaysElapsed(lastEvent.occurred_at, now) : null;
      const totalOccurrences = actEvents.length;
      const occurrencesThisMonth = actEvents.filter((e) => isThisMonth(e.occurred_at, now)).length;
      const occurrencesThisYear = actEvents.filter((e) => isThisYear(e.occurred_at, now)).length;

      const reminderInfo = checkReminderStatus(
        lastEvent?.occurred_at,
        activity.reminder_interval_days,
        now
      );

      return {
        activity,
        lastEvent,
        daysAgo,
        totalOccurrences,
        occurrencesThisMonth,
        occurrencesThisYear,
        isOverdue: reminderInfo.isOverdue,
        daysOverdue: reminderInfo.daysOverdue,
      };
    });
  }, [activities, events]);

  // Sync data from Google Sheets
  const syncWithGoogleSheets = useCallback(
    async (accessToken: string, targetSheetId?: string) => {
      const sheetId = targetSheetId || syncStatus.spreadsheetId;
      if (!sheetId) {
        setSyncStatus((s) => ({ ...s, state: 'idle' }));
        return;
      }

      setSyncStatus((s) => ({ ...s, state: 'syncing', errorMessage: undefined }));

      try {
        // Ensure structure first if needed
        const details = await ensureSpreadsheetStructure(accessToken, sheetId);
        const { activities: fetchedActs, events: fetchedEvts } = await fetchAllData(
          accessToken,
          sheetId
        );

        setActivities(fetchedActs);
        setEvents(fetchedEvts);
        setSyncStatus({
          state: 'synced',
          lastSyncedAt: new Date(),
          spreadsheetId: sheetId,
          spreadsheetTitle: details.title,
        });
      } catch (err: any) {
        console.error('Sheets sync failed:', err);
        setSyncStatus((s) => ({
          ...s,
          state: 'error',
          errorMessage: err.message || 'Synchronization failed',
        }));
        addToast('error', err.message || 'Failed to sync with Google Sheets.', 'Sync Error');
      }
    },
    [syncStatus.spreadsheetId, addToast]
  );

  // Initialize Auth on app load
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setCachedAccessToken(currentToken);
        const storedSheetId = localStorage.getItem(LOCAL_STORAGE_SHEET_KEY);
        if (storedSheetId && currentToken) {
          syncWithGoogleSheets(currentToken, storedSheetId);
        }
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    return () => unsubscribe();
  }, [syncWithGoogleSheets]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        addToast('success', `Signed in as ${result.user.email}`);

        // If we don't have a spreadsheet yet, auto create or prompt
        const storedSheetId = localStorage.getItem(LOCAL_STORAGE_SHEET_KEY);
        if (storedSheetId) {
          await syncWithGoogleSheets(result.accessToken, storedSheetId);
        } else {
          // Auto create a dedicated spreadsheet on first sign-in
          try {
            setSyncStatus((s) => ({ ...s, state: 'syncing' }));
            const created = await createDedicatedSpreadsheet(result.accessToken);
            localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, created.spreadsheetId);
            setSyncStatus({
              state: 'synced',
              lastSyncedAt: new Date(),
              spreadsheetId: created.spreadsheetId,
              spreadsheetTitle: created.title,
            });
            addToast('success', 'Created "LifeLog" spreadsheet in your Google Drive!');
          } catch (createErr: any) {
            console.error('Auto create sheet failed:', createErr);
            addToast(
              'info',
              'Connected to Google. You can create or choose a spreadsheet in Settings.',
              'Connected'
            );
          }
        }
      }
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      addToast('error', err.message || 'Google Sign-in failed.', 'Authentication Error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setSyncStatus((s) => ({ ...s, state: 'idle' }));
    addToast('info', 'Signed out of Google account.');
  };

  // Manual force sync
  const handleManualSync = async () => {
    const accessToken = token || (await getAccessToken());
    if (!accessToken) {
      await handleSignIn();
      return;
    }
    if (!syncStatus.spreadsheetId) {
      setCurrentTab('settings');
      addToast('info', 'Please create or connect a spreadsheet first in Settings.');
      return;
    }
    await syncWithGoogleSheets(accessToken, syncStatus.spreadsheetId);
    addToast('success', 'Google Sheets synchronization completed!');
  };

  // Create new dedicated spreadsheet
  const handleCreateNewSpreadsheet = async () => {
    const accessToken = token || (await getAccessToken());
    if (!accessToken) {
      throw new Error('Please sign in to Google first.');
    }

    const created = await createDedicatedSpreadsheet(accessToken);
    localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, created.spreadsheetId);
    setSyncStatus({
      state: 'synced',
      lastSyncedAt: new Date(),
      spreadsheetId: created.spreadsheetId,
      spreadsheetTitle: created.title,
    });
    setActivities([]);
    setEvents([]);
    addToast('success', `Created spreadsheet: ${created.title}`);
  };

  // Connect existing spreadsheet
  const handleConnectExistingSpreadsheet = async (sheetId: string) => {
    const accessToken = token || (await getAccessToken());
    if (!accessToken) {
      throw new Error('Please sign in to Google first.');
    }

    const details = await ensureSpreadsheetStructure(accessToken, sheetId);
    localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, sheetId);
    setSyncStatus({
      state: 'synced',
      lastSyncedAt: new Date(),
      spreadsheetId: sheetId,
      spreadsheetTitle: details.title,
    });
    await syncWithGoogleSheets(accessToken, sheetId);
    addToast('success', `Connected to "${details.title}"`);
  };

  // Seed starter activities
  const handleSeedStarterActivities = async () => {
    const nowIso = new Date().toISOString();
    const existingIds = new Set(activities.map((a) => a.activity_id));
    const toAdd: Activity[] = STARTER_ACTIVITIES.filter((a) => !existingIds.has(a.activity_id)).map(
      (a) => ({
        ...a,
        created_at: nowIso,
        updated_at: nowIso,
      })
    );

    if (toAdd.length === 0) {
      addToast('info', 'All starter activities are already present in your library.');
      return;
    }

    const newActivities = [...activities, ...toAdd];
    setActivities(newActivities);

    const accessToken = token || (await getAccessToken());
    if (accessToken && syncStatus.spreadsheetId) {
      try {
        await batchInsertActivities(accessToken, syncStatus.spreadsheetId, toAdd);
        setSyncStatus((s) => ({ ...s, lastSyncedAt: new Date(), state: 'synced' }));
        addToast('success', `Added ${toAdd.length} starter activities to Google Sheets!`);
      } catch (err: any) {
        console.error('Failed to write starter activities to Sheets:', err);
        addToast(
          'error',
          'Failed to write to Google Sheets. Updated locally only.',
          'Sync Warning'
        );
      }
    } else {
      addToast('success', `Added ${toAdd.length} starter activities.`);
    }
  };

  // Save or update an Activity
  const handleSaveActivity = async (activity: Activity) => {
    const existingIndex = activities.findIndex((a) => a.activity_id === activity.activity_id);
    let updatedActivities: Activity[];
    if (existingIndex >= 0) {
      updatedActivities = [...activities];
      updatedActivities[existingIndex] = activity;
    } else {
      updatedActivities = [...activities, activity];
    }
    setActivities(updatedActivities);

    // Sync to Sheets
    const accessToken = token || (await getAccessToken());
    if (accessToken && syncStatus.spreadsheetId) {
      try {
        await saveActivityRow(accessToken, syncStatus.spreadsheetId, activity);
        setSyncStatus((s) => ({ ...s, lastSyncedAt: new Date(), state: 'synced' }));
        addToast(
          'success',
          existingIndex >= 0
            ? `Updated "${activity.name}" in Google Sheets`
            : `Created "${activity.name}" in Google Sheets`
        );
      } catch (err: any) {
        console.error('Failed to save activity to Sheets:', err);
        addToast('error', err.message || 'Failed to update Google Sheets', 'Sync Error');
      }
    } else {
      addToast('success', `Saved "${activity.name}" locally`);
    }
  };

  // Save an Event (from Modal or Quick Log)
  const handleSaveEvent = async (data: {
    activityId: string;
    activityName: string;
    occurredAt: string;
    notes?: string;
    category?: string;
    tags: string[];
    isNewActivity?: boolean;
  }) => {
    const nowIso = new Date().toISOString();

    // If new activity created inline, save it first
    if (data.isNewActivity) {
      const newAct: Activity = {
        activity_id: data.activityId,
        name: data.activityName,
        category: data.category || 'General',
        tags: data.tags,
        reminder_interval_days: 14,
        created_at: nowIso,
        updated_at: nowIso,
        archived: false,
      };
      await handleSaveActivity(newAct);
    }

    const newEvent: LifeEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      activity_id: data.activityId,
      activity_name: data.activityName,
      occurred_at: data.occurredAt,
      recorded_at: nowIso,
      notes: data.notes,
      tags: data.tags,
      updated_at: nowIso,
    };

    // Update local state (sorted newest first by occurred_at)
    setEvents((prev) => {
      const updated = [newEvent, ...prev];
      return updated.sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
    });

    // Write to Google Sheets
    const accessToken = token || (await getAccessToken());
    if (accessToken && syncStatus.spreadsheetId) {
      try {
        await saveEventRow(accessToken, syncStatus.spreadsheetId, newEvent);
        setSyncStatus((s) => ({ ...s, lastSyncedAt: new Date(), state: 'synced' }));
        addToast('success', `Logged "${data.activityName}" to Google Sheets!`);
      } catch (err: any) {
        console.error('Failed to save event to Sheets:', err);
        addToast(
          'error',
          'Failed to record row in Google Sheets. Saved locally.',
          'Sync Warning'
        );
      }
    } else {
      addToast('success', `Logged "${data.activityName}"!`);
    }
  };

  // Quick 1-tap logging
  const handleQuickLogNow = async (activity: Activity) => {
    const nowIso = new Date().toISOString();
    await handleSaveEvent({
      activityId: activity.activity_id,
      activityName: activity.name,
      occurredAt: nowIso,
      category: activity.category,
      tags: activity.tags,
    });
  };

  // Update existing event
  const handleUpdateEvent = async (updatedEvent: LifeEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.event_id === updatedEvent.event_id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = updatedEvent;
      return copy.sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
    });

    const accessToken = token || (await getAccessToken());
    if (accessToken && syncStatus.spreadsheetId) {
      try {
        await saveEventRow(accessToken, syncStatus.spreadsheetId, updatedEvent);
        setSyncStatus((s) => ({ ...s, lastSyncedAt: new Date(), state: 'synced' }));
        addToast('success', 'Event row updated in Google Sheets!');
      } catch (err: any) {
        console.error('Failed to update event in Sheets:', err);
        addToast('error', 'Failed to update row in Google Sheets.', 'Sync Warning');
      }
    } else {
      addToast('success', 'Event updated locally.');
    }
  };

  // Delete event with user confirmation
  const handleDeleteEvent = async (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.event_id !== eventId));

    const accessToken = token || (await getAccessToken());
    if (accessToken && syncStatus.spreadsheetId) {
      try {
        await deleteEventRow(accessToken, syncStatus.spreadsheetId, eventId);
        setSyncStatus((s) => ({ ...s, lastSyncedAt: new Date(), state: 'synced' }));
        addToast('success', 'Event deleted from Google Sheets!');
      } catch (err: any) {
        console.error('Failed to delete event row from Sheets:', err);
        addToast('error', 'Failed to remove row from Google Sheets.', 'Sync Error');
      }
    } else {
      addToast('success', 'Event removed.');
    }
  };

  // Import JSON backup
  const handleImportBackup = async (data: { activities: Activity[]; events: LifeEvent[] }) => {
    setActivities(data.activities);
    setEvents(data.events);

    const accessToken = token || (await getAccessToken());
    if (accessToken && syncStatus.spreadsheetId) {
      try {
        for (const act of data.activities) {
          await saveActivityRow(accessToken, syncStatus.spreadsheetId, act);
        }
        for (const evt of data.events) {
          await saveEventRow(accessToken, syncStatus.spreadsheetId, evt);
        }
        setSyncStatus((s) => ({ ...s, lastSyncedAt: new Date(), state: 'synced' }));
        addToast('success', 'Backup restored and written to Google Sheets!');
      } catch (err: any) {
        console.error('Failed to sync backup to Sheets:', err);
        addToast('error', 'Imported locally, but Sheets sync had errors.', 'Import Warning');
      }
    }
  };

  // Navigation helpers
  const handleNavigateToHistory = (activityId?: string) => {
    setHistoryFilterActivityId(activityId);
    setCurrentTab('history');
  };

  const openLogModalWithActivity = (activityId?: string) => {
    setLogModalInitialActivityId(activityId);
    setIsLogModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500 selection:text-stone-950">
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'history') setHistoryFilterActivityId(undefined);
          setCurrentTab(tab);
        }}
        onOpenLogModal={() => openLogModalWithActivity()}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        isAuthenticating={isAuthenticating}
      />

      <main className="pb-16">
        {currentTab === 'dashboard' && (
          <Dashboard
            activities={activities}
            events={events}
            summaries={summaries}
            onOpenLogModal={openLogModalWithActivity}
            onNavigateToHistory={handleNavigateToHistory}
            onQuickLogNow={handleQuickLogNow}
            onOpenSettings={() => setCurrentTab('settings')}
            onSeedStarterActivities={handleSeedStarterActivities}
            isAuthenticated={Boolean(user)}
            onSignIn={handleSignIn}
            isSyncing={syncStatus.state === 'syncing'}
          />
        )}

        {currentTab === 'history' && (
          <EventHistory
            events={events}
            activities={activities}
            initialFilterActivityId={historyFilterActivityId}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
            onOpenLogModal={openLogModalWithActivity}
          />
        )}

        {currentTab === 'activities' && (
          <ActivityLibrary
            activities={activities}
            summaries={summaries}
            onSaveActivity={handleSaveActivity}
            onNavigateToHistory={handleNavigateToHistory}
            onOpenLogModal={openLogModalWithActivity}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsModal
            user={user}
            syncStatus={syncStatus}
            activities={activities}
            events={events}
            onManualSync={handleManualSync}
            onCreateNewSpreadsheet={handleCreateNewSpreadsheet}
            onConnectExistingSpreadsheet={handleConnectExistingSpreadsheet}
            onSeedStarterActivities={handleSeedStarterActivities}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onImportBackup={handleImportBackup}
          />
        )}
      </main>

      {/* Quick Log Modal */}
      <LogEventModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        activities={activities}
        initialActivityId={logModalInitialActivityId}
        onSaveEvent={handleSaveEvent}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
