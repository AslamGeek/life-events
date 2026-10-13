import { Activity, LifeEvent } from '../types';

export const ACTIVITIES_SHEET = 'Activities';
export const EVENTS_SHEET = 'Events';

const ACTIVITIES_HEADERS = [
  'activity_id',
  'name',
  'category',
  'tags',
  'reminder_interval_days',
  'created_at',
  'updated_at',
  'archived',
];

const EVENTS_HEADERS = [
  'event_id',
  'activity_id',
  'activity_name',
  'occurred_at',
  'recorded_at',
  'notes',
  'tags',
  'updated_at',
];

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: { id: number; title: string }[];
}

/**
 * Helper to execute authorized Google Sheets API calls
 */
async function sheetsApiFetch(url: string, token: string, options: RequestInit = {}): Promise<any> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let errBody: any;
    try {
      errBody = await response.json();
    } catch {
      errBody = { message: response.statusText };
    }
    const message = errBody?.error?.message || errBody?.message || `HTTP error ${response.status}`;
    throw new Error(`Google Sheets API error (${response.status}): ${message}`);
  }
  return response.json();
}

/**
 * Fetch spreadsheet metadata to inspect existing tabs and IDs
 */
export async function getSpreadsheetDetails(
  token: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const data = await sheetsApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`,
    token
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Personal Life Event Tracker',
    sheets: (data.sheets || []).map((s: any) => ({
      id: s.properties.sheetId,
      title: s.properties.title,
    })),
  };
}

/**
 * Automatically create a new Google Spreadsheet with properly formatted Activities and Events worksheets
 */
export async function createDedicatedSpreadsheet(
  token: string,
  title: string = 'LifeLog — Personal Life Event Tracker'
): Promise<SpreadsheetMetadata> {
  const payload = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: ACTIVITIES_SHEET,
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 10,
          },
        },
      },
      {
        properties: {
          title: EVENTS_SHEET,
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 10,
          },
        },
      },
    ],
  };

  const created = await sheetsApiFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  const newSpreadsheetId = created.spreadsheetId;

  // Insert header rows into both worksheets
  await sheetsApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values:batchUpdate`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${ACTIVITIES_SHEET}!A1:H1`,
            values: [ACTIVITIES_HEADERS],
          },
          {
            range: `${EVENTS_SHEET}!A1:H1`,
            values: [EVENTS_HEADERS],
          },
        ],
      }),
    }
  );

  return getSpreadsheetDetails(token, newSpreadsheetId);
}

/**
 * Ensure an existing spreadsheet has the required Activities and Events tabs and headers
 */
export async function ensureSpreadsheetStructure(
  token: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const metadata = await getSpreadsheetDetails(token, spreadsheetId);
  const existingSheetTitles = new Set(metadata.sheets.map((s) => s.title));

  const addRequests: any[] = [];
  if (!existingSheetTitles.has(ACTIVITIES_SHEET)) {
    addRequests.push({
      addSheet: {
        properties: {
          title: ACTIVITIES_SHEET,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }
  if (!existingSheetTitles.has(EVENTS_SHEET)) {
    addRequests.push({
      addSheet: {
        properties: {
          title: EVENTS_SHEET,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (addRequests.length > 0) {
    await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ requests: addRequests }),
      }
    );
  }

  // Ensure header rows exist
  const batchValueData: any[] = [];
  if (!existingSheetTitles.has(ACTIVITIES_SHEET)) {
    batchValueData.push({
      range: `${ACTIVITIES_SHEET}!A1:H1`,
      values: [ACTIVITIES_HEADERS],
    });
  }
  if (!existingSheetTitles.has(EVENTS_SHEET)) {
    batchValueData.push({
      range: `${EVENTS_SHEET}!A1:H1`,
      values: [EVENTS_HEADERS],
    });
  }

  if (batchValueData.length > 0) {
    await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchValueData,
        }),
      }
    );
  }

  return getSpreadsheetDetails(token, spreadsheetId);
}

/**
 * Fetch all activities and events in a single batch read
 */
export async function fetchAllData(
  token: string,
  spreadsheetId: string
): Promise<{ activities: Activity[]; events: LifeEvent[] }> {
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ACTIVITIES_SHEET}!A1:H&ranges=${EVENTS_SHEET}!A1:H`;
  const result = await sheetsApiFetch(batchUrl, token);

  const valueRanges = result.valueRanges || [];
  const activitiesRows = valueRanges[0]?.values || [];
  const eventsRows = valueRanges[1]?.values || [];

  const activities: Activity[] = [];
  // Skip header row
  for (let i = 1; i < activitiesRows.length; i++) {
    const row = activitiesRows[i];
    if (!row || !row[0]) continue; // Must have activity_id

    const tagsRaw = row[3] || '';
    let tags: string[] = [];
    if (tagsRaw.startsWith('[') && tagsRaw.endsWith(']')) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        tags = tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    } else if (tagsRaw) {
      tags = tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    const reminderDays = row[4] ? parseInt(row[4], 10) : null;
    const archivedStr = String(row[7]).toLowerCase().trim();
    const archived = archivedStr === 'true' || archivedStr === 'yes' || archivedStr === '1';

    activities.push({
      activity_id: String(row[0]).trim(),
      name: String(row[1] || '').trim(),
      category: String(row[2] || 'General').trim(),
      tags,
      reminder_interval_days: isNaN(reminderDays as number) ? null : reminderDays,
      created_at: row[5] || new Date().toISOString(),
      updated_at: row[6] || new Date().toISOString(),
      archived,
    });
  }

  const events: LifeEvent[] = [];
  // Skip header row
  for (let i = 1; i < eventsRows.length; i++) {
    const row = eventsRows[i];
    if (!row || !row[0]) continue; // Must have event_id

    const tagsRaw = row[6] || '';
    let tags: string[] = [];
    if (tagsRaw.startsWith('[') && tagsRaw.endsWith(']')) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        tags = tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    } else if (tagsRaw) {
      tags = tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    events.push({
      event_id: String(row[0]).trim(),
      activity_id: String(row[1] || '').trim(),
      activity_name: String(row[2] || '').trim(),
      occurred_at: row[3] || new Date().toISOString(),
      recorded_at: row[4] || new Date().toISOString(),
      notes: row[5] || '',
      tags,
      updated_at: row[7] || new Date().toISOString(),
    });
  }

  // Sort events newest first by default based on occurred_at
  events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return { activities, events };
}

/**
 * Append or update an activity row reconciled by activity_id
 */
export async function saveActivityRow(
  token: string,
  spreadsheetId: string,
  activity: Activity
): Promise<void> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${ACTIVITIES_SHEET}!A:A`;
  const data = await sheetsApiFetch(getUrl, token);
  const rows: string[][] = data.values || [];

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][0] === activity.activity_id) {
      targetRowIndex = i + 1; // 1-indexed for Sheets A1 notation
      break;
    }
  }

  const rowValues = [
    activity.activity_id,
    activity.name,
    activity.category,
    activity.tags.join(', '),
    activity.reminder_interval_days !== null ? activity.reminder_interval_days : '',
    activity.created_at,
    activity.updated_at,
    activity.archived ? 'TRUE' : 'FALSE',
  ];

  if (targetRowIndex > 0) {
    // Update existing row
    await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${ACTIVITIES_SHEET}!A${targetRowIndex}:H${targetRowIndex}?valueInputOption=USER_ENTERED`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );
  } else {
    // Append new row
    await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${ACTIVITIES_SHEET}!A:H:append?valueInputOption=USER_ENTERED`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );
  }
}

/**
 * Batch insert multiple activities (e.g. for starter seeding)
 */
export async function batchInsertActivities(
  token: string,
  spreadsheetId: string,
  activities: Activity[]
): Promise<void> {
  if (activities.length === 0) return;

  const rows = activities.map((a) => [
    a.activity_id,
    a.name,
    a.category,
    a.tags.join(', '),
    a.reminder_interval_days !== null ? a.reminder_interval_days : '',
    a.created_at,
    a.updated_at,
    a.archived ? 'TRUE' : 'FALSE',
  ]);

  await sheetsApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${ACTIVITIES_SHEET}!A:H:append?valueInputOption=USER_ENTERED`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    }
  );
}

/**
 * Append or update an event row reconciled by event_id
 */
export async function saveEventRow(
  token: string,
  spreadsheetId: string,
  event: LifeEvent
): Promise<void> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${EVENTS_SHEET}!A:A`;
  const data = await sheetsApiFetch(getUrl, token);
  const rows: string[][] = data.values || [];

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][0] === event.event_id) {
      targetRowIndex = i + 1; // 1-indexed for Sheets
      break;
    }
  }

  const rowValues = [
    event.event_id,
    event.activity_id,
    event.activity_name,
    event.occurred_at,
    event.recorded_at,
    event.notes || '',
    event.tags.join(', '),
    event.updated_at,
  ];

  if (targetRowIndex > 0) {
    // Update existing row
    await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${EVENTS_SHEET}!A${targetRowIndex}:H${targetRowIndex}?valueInputOption=USER_ENTERED`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );
  } else {
    // Append new row
    await sheetsApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${EVENTS_SHEET}!A:H:append?valueInputOption=USER_ENTERED`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );
  }
}

/**
 * Delete an event row strictly by event_id
 */
export async function deleteEventRow(
  token: string,
  spreadsheetId: string,
  eventId: string
): Promise<void> {
  // First, find the Events worksheet numeric ID
  const metadata = await getSpreadsheetDetails(token, spreadsheetId);
  const eventsSheet = metadata.sheets.find((s) => s.title === EVENTS_SHEET);
  if (!eventsSheet) {
    throw new Error(`Worksheet "${EVENTS_SHEET}" not found in spreadsheet.`);
  }

  // Find the row index (0-indexed) where col A equals eventId
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${EVENTS_SHEET}!A:A`;
  const data = await sheetsApiFetch(getUrl, token);
  const rows: string[][] = data.values || [];

  let rowIndexToDelete = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][0] === eventId) {
      rowIndexToDelete = i; // 0-indexed row for deleteDimension
      break;
    }
  }

  if (rowIndexToDelete === -1) {
    throw new Error(`Event with ID "${eventId}" was not found in Google Sheets.`);
  }

  // Delete only this specific row
  await sheetsApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: eventsSheet.id,
                dimension: 'ROWS',
                startIndex: rowIndexToDelete,
                endIndex: rowIndexToDelete + 1,
              },
            },
          },
        ],
      }),
    }
  );
}
