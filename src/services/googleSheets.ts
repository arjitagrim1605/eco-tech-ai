/**
 * Service for Google Sheets API v4 Integration
 * Directly uses client-side Bearer access tokens from OAuth flow
 */

export interface LoginSheetRecord {
  name: string;
  email: string;
  phone: string;
  college: string;
  timestamp?: string;
}

export interface FeedbackSheetRecord {
  name: string;
  email: string;
  rating: number;
  category: string;
  comment: string;
  timestamp?: string;
}

export const DEFAULT_SHEET_ID_KEY = 'eco_tech_spreadsheet_id';
export const DEFAULT_SHEET_URL_KEY = 'eco_tech_spreadsheet_url';

/**
 * Normalizes a raw string or full URL into a clean Google Spreadsheet ID
 */
export function normalizeSpreadsheetId(input: string): string {
  if (!input) return '';
  const match = input.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

/**
 * Creates a brand new Google Spreadsheet dedicated to Eco Tech AI
 */
export async function createEcoTechSpreadsheet(accessToken: string): Promise<{ id: string; url: string }> {
  const requestBody = {
    properties: {
      title: 'Eco Tech AI - Master Data Hub',
    },
    sheets: [
      {
        properties: {
          title: 'User Logins',
          gridProperties: { rowCount: 1000, columnCount: 10 },
        },
      },
      {
        properties: {
          title: 'Community Feedback',
          gridProperties: { rowCount: 1000, columnCount: 10 },
        },
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText || 'Failed to create Google Spreadsheet';
    throw new Error(message);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize header rows safely
  try {
    await initSheetHeaders(accessToken, spreadsheetId);
  } catch (err) {
    console.warn('Headers initialization warning (sheet created):', err);
  }

  localStorage.setItem(DEFAULT_SHEET_ID_KEY, spreadsheetId);
  localStorage.setItem(DEFAULT_SHEET_URL_KEY, spreadsheetUrl);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Initializes header styling and text in the two tabs
 */
export async function initSheetHeaders(accessToken: string, spreadsheetId: string) {
  const cleanId = normalizeSpreadsheetId(spreadsheetId);

  // Headers for User Logins
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'User Logins'!A1:F1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: "'User Logins'!A1:F1",
        majorDimension: 'ROWS',
        values: [
          [
            'Timestamp',
            'Full Name',
            'Email Address',
            'Phone Number',
            'Class / College',
            'Session Identifier',
          ],
        ],
      }),
    }
  );

  // Headers for Community Feedback
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'Community Feedback'!A1:F1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: "'Community Feedback'!A1:F1",
        majorDimension: 'ROWS',
        values: [
          [
            'Timestamp',
            'User Name',
            'User Email',
            'Star Rating (1-5)',
            'Category',
            'Eco Tip / Suggestions',
          ],
        ],
      }),
    }
  );
}

/**
 * Checks if a tab exists, and if not creates it via batchUpdate
 */
async function ensureSheetTabExists(
  accessToken: string,
  spreadsheetId: string,
  targetTitle: string,
  headers: string[]
): Promise<string> {
  const cleanId = normalizeSpreadsheetId(spreadsheetId);
  try {
    const meta = await fetchSpreadsheetInfo(accessToken, cleanId);
    const existingTitles: string[] = meta.sheets?.map((s: any) => s.properties?.title) || [];

    if (existingTitles.includes(targetTitle)) {
      return targetTitle;
    }

    // Try to create the tab
    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: targetTitle },
            },
          },
        ],
      }),
    });

    if (addRes.ok) {
      // Put header row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${targetTitle}'!A1:${String.fromCharCode(64 + headers.length)}1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [headers] }),
        }
      );
      return targetTitle;
    }

    // If addSheet fails, fallback to first existing sheet title (e.g. Sheet1)
    return existingTitles[0] || 'Sheet1';
  } catch (err) {
    console.warn('ensureSheetTabExists warning:', err);
    return targetTitle;
  }
}

/**
 * Appends a User Login Record to the Google Sheet
 */
export async function appendLoginRecord(
  accessToken: string,
  spreadsheetId: string,
  record: LoginSheetRecord
): Promise<boolean> {
  const cleanId = normalizeSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Invalid spreadsheet ID');

  const targetTab = await ensureSheetTabExists(accessToken, cleanId, 'User Logins', [
    'Timestamp',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Class / College',
    'Session Identifier',
  ]);

  const values = [
    [
      record.timestamp || new Date().toLocaleString(),
      record.name,
      record.email,
      record.phone,
      record.college,
      `ECO-${Date.now().toString(36).toUpperCase()}`,
    ],
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${targetTab}'!A:F:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to append login to Google Sheet');
  }

  return true;
}

/**
 * Appends a Feedback & Star Review Record to the Google Sheet
 */
export async function appendFeedbackRecord(
  accessToken: string,
  spreadsheetId: string,
  feedback: FeedbackSheetRecord
): Promise<boolean> {
  const cleanId = normalizeSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Invalid spreadsheet ID');

  const targetTab = await ensureSheetTabExists(accessToken, cleanId, 'Community Feedback', [
    'Timestamp',
    'User Name',
    'User Email',
    'Star Rating (1-5)',
    'Category',
    'Eco Tip / Suggestions',
  ]);

  const values = [
    [
      feedback.timestamp || new Date().toLocaleString(),
      feedback.name,
      feedback.email,
      `${feedback.rating} / 5 Stars`,
      feedback.category,
      feedback.comment,
    ],
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${targetTab}'!A:F:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to append feedback to Google Sheet');
  }

  return true;
}

/**
 * Batch appends multiple Feedback Records to Google Sheets
 */
export async function appendMultipleFeedbackRecords(
  accessToken: string,
  spreadsheetId: string,
  feedbacks: FeedbackSheetRecord[]
): Promise<number> {
  if (!feedbacks || feedbacks.length === 0) return 0;
  const cleanId = normalizeSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Invalid spreadsheet ID');

  const targetTab = await ensureSheetTabExists(accessToken, cleanId, 'Community Feedback', [
    'Timestamp',
    'User Name',
    'User Email',
    'Star Rating (1-5)',
    'Category',
    'Eco Tip / Suggestions',
  ]);

  const values = feedbacks.map((f) => [
    f.timestamp || new Date().toLocaleString(),
    f.name,
    f.email,
    `${f.rating} / 5 Stars`,
    f.category,
    f.comment,
  ]);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${targetTab}'!A:F:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to append feedbacks to Google Sheet');
  }

  return values.length;
}

/**
 * Batch appends multiple Login Records to Google Sheets
 */
export async function appendMultipleLoginRecords(
  accessToken: string,
  spreadsheetId: string,
  logins: LoginSheetRecord[]
): Promise<number> {
  if (!logins || logins.length === 0) return 0;
  const cleanId = normalizeSpreadsheetId(spreadsheetId);
  if (!cleanId) throw new Error('Invalid spreadsheet ID');

  const targetTab = await ensureSheetTabExists(accessToken, cleanId, 'User Logins', [
    'Timestamp',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Class / College',
    'Session Identifier',
  ]);

  const values = logins.map((record) => [
    record.timestamp || new Date().toLocaleString(),
    record.name,
    record.email,
    record.phone,
    record.college,
    `ECO-${Date.now().toString(36).toUpperCase()}`,
  ]);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${targetTab}'!A:F:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to append logins to Google Sheet');
  }

  return values.length;
}

/**
 * Checks spreadsheet accessibility and reads basic details
 */
export async function fetchSpreadsheetInfo(accessToken: string, spreadsheetId: string) {
  const cleanId = normalizeSpreadsheetId(spreadsheetId);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Could not access spreadsheet. Check permissions.');
  }

  return await response.json();
}
