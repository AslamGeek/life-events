# LifeLog — Personal Life Event Tracker with Google Sheets Sync

LifeLog is a responsive web application designed for tracking personal life events and everyday routines over time (e.g. "When did I last cut my beard?", "When did I last wash clothes?", "How many times did I walk in the park this month?", "Which activities are overdue?").

Google Sheets is used as the persistent data store, giving you complete ownership of your personal data in your own Google Drive.

---

## 1. Core Capabilities

- **Dashboard**:
  - Instant Answers for natural-language questions (e.g., *"When did I last cut my beard?"*, *"Show laundry this month"*, *"Which activities have not happened in 30 days?"*).
  - Quick 1-Tap Logging for frequently used activities.
  - Tracked activities summary with elapsed time calculations (*"3 days ago"*, *"Yesterday"*, *"Just now"*).
  - Overdue alerts based on custom reminder intervals (e.g. every 14 days).
  - Recent event timeline with occurred and recorded timestamps.
- **Quick Event Logging**:
  - Modal logging with pre-filled current local time and quick presets (*Right now*, *1h ago*, *Earlier today*, *Yesterday*, *2 days ago*).
  - New custom activities can be created inline on the fly.
  - Notes, categories, and tags support.
  - Accidental duplicate submission protection with loading state & idempotency.
- **Activity Management**:
  - Create and manage custom routines (Beard Cut, Laundry, Car Service, Watering Plants, Bedsheets, Deep Clean, Gym, etc.).
  - Rename activities without breaking historical logs (reconciled by stable `activity_id`).
  - Archive/unarchive activities while strictly preserving all historical logs.
  - Set reminder intervals in days.
- **Event History & Timeline**:
  - Full-text search across activity names, notes, and tags.
  - Filter by activity, category, and date range (Today, Past 7 Days, This Month, This Year, All Time).
  - Sort newest-first or oldest-first based on actual occurrence time.
  - In-place event editing (updates the exact row in Google Sheets).
  - Event deletion protected by an explicit user confirmation dialog (meeting Workspace Integration guidelines).
  - Pagination controls for large event logs.
- **Google Sheets Persistence & Sync**:
  - Direct read and write via Google Sheets API v4 using authenticated OAuth access tokens.
  - Automatic creation of a dedicated "LifeLog" spreadsheet in Google Drive on first connection.
  - Support for connecting existing spreadsheets by ID or URL.
  - Manual sync trigger with last-synced timestamp.
  - JSON backup export and restore tools.

---

## 2. Google Sheets Schema

LifeLog uses two worksheets inside your Google Spreadsheet:

### Worksheet 1: `Activities`
| Column | Description | Type |
|---|---|---|
| `activity_id` | Stable unique identifier (e.g. `act_beard_cut`) | String |
| `name` | User-visible activity name (can be renamed anytime) | String |
| `category` | Category classification (e.g., Grooming, Chores, Health) | String |
| `tags` | Comma-separated tags (e.g., `grooming, hair`) | String |
| `reminder_interval_days` | Desired frequency cycle in days (e.g. `14`), or blank | Integer / Blank |
| `created_at` | Record creation timestamp in ISO 8601 with timezone | String |
| `updated_at` | Last updated timestamp in ISO 8601 with timezone | String |
| `archived` | `TRUE` if archived, `FALSE` if active | Boolean String |

### Worksheet 2: `Events`
| Column | Description | Type |
|---|---|---|
| `event_id` | Stable unique event record ID (e.g. `evt_1728...`) | String |
| `activity_id` | Foreign key reference to `Activities` worksheet | String |
| `activity_name` | Snapshot of activity name at the time of logging | String |
| `occurred_at` | Exact date & time when the life event took place (ISO 8601) | String |
| `recorded_at` | Date & time when the record was entered (ISO 8601) | String |
| `notes` | Optional personal notes | String |
| `tags` | Comma-separated tags | String |
| `updated_at` | Last updated timestamp in ISO 8601 | String |

---

## 3. Data Integrity & Synchronization Model

- **Source of Truth**: Google Sheets is the canonical source of truth.
- **ID-Based Reconciliation**: Updates and deletions locate rows dynamically by matching `activity_id` or `event_id`, never relying on fragile row numbers. Manual row reordering in Google Sheets will not break synchronization.
- **Two Distinct Timestamps**: `occurred_at` (when it happened) is strictly separated from `recorded_at` (when it was logged), ensuring retroactive logs correctly position in chronological sorting and elapsed-time calculations.
- **In-Memory Security**: OAuth tokens are held strictly in application memory and are never persisted to localStorage or sessionStorage.

---

## 4. Google Cloud & OAuth Setup Instructions

1. **Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Select or create your project.
   - Under **APIs & Services > Library**, enable:
     - **Google Sheets API**
     - **Google Drive API**
2. **OAuth Consent Screen**:
   - Set User Type to External (or Internal if using Google Workspace organization).
   - Add scopes:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.file`
   - Add your test user email under Test Users.
3. **Credentials**:
   - In Google Cloud Console, create OAuth 2.0 Client IDs (Web application).
   - In this AI Studio runtime, Firebase Auth is provisioned via `firebase-applet-config.json` with the Google provider enabled.

---

## 5. Development & Testing

### Running the App
```bash
# Install dependencies
npm install

# Start local development server (port 3000)
npm run dev

# Build for production
npm run build
```

### Running Automated Business Logic Tests
LifeLog includes an automated test suite verifying date calculations, elapsed wording (singular/plural), overdue evaluation, chronological sorting by `occurred_at`, and natural-language query resolution:
```bash
npm test
```
All 16 tests run via `tsx tests/runTests.ts`.

---

## 6. Limitations of Google Sheets as a Backend

- **Latency**: Google Sheets API calls typically take 200–800ms per request. LifeLog provides instant local UI updates and loading states to ensure responsiveness.
- **Rate Limits**: Google Sheets API has per-user quotas (typically 60 requests per minute). LifeLog batches initial data reads (`values:batchGet`) to minimize quota usage.
- **Manual Sheet Edits**: If you edit values directly inside Google Sheets, click the **Force Sync Now** button (or reload the page) to reflect the changes in the app.
