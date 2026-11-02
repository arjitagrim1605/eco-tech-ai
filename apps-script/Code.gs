/**
 * Bind this script to the Eco Tech AI - Master Data Hub spreadsheet.
 * Set SPREADSHEET_ID and FEEDBACK_SYNC_SECRET in Script Properties.
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return jsonResponse({ success: false, error: 'Invalid request' });
  }

  const properties = PropertiesService.getScriptProperties();
  const expectedSecret = properties.getProperty('FEEDBACK_SYNC_SECRET');
  if (!expectedSecret || payload.secret !== expectedSecret) return jsonResponse({ success: false, error: 'Unauthorized' });

  const loginRecords = Array.isArray(payload.logins)
    ? payload.logins.slice(0, 100)
    : payload.login ? [payload.login] : [];
  if (loginRecords.length) return appendLoginRecords(loginRecords);

  const feedbacks = Array.isArray(payload.feedbacks)
    ? payload.feedbacks.slice(0, 100)
    : payload.feedback ? [payload.feedback] : [];
  if (!feedbacks.length) return jsonResponse({ success: false, error: 'No feedback provided' });

  const rows = [];
  for (const feedback of feedbacks) {
    const id = String(feedback.id || '').trim();
    const name = String(feedback.name || '').trim();
    const comment = String(feedback.comment || '').trim();
    const category = String(feedback.category || 'Tip').trim().slice(0, 80);
    const rating = Math.max(1, Math.min(5, Math.round(Number(feedback.rating) || 5)));
    if (!id || !name || !comment || name.length > 80 || comment.length > 2000) {
      return jsonResponse({ success: false, error: 'Invalid feedback' });
    }
    rows.push([
      safeCell(String(feedback.timestamp || new Date().toISOString())),
      safeCell(name),
      '',
      `${rating} / 5 Stars`,
      safeCell(category),
      safeCell(comment),
      id,
    ]);
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonResponse({ success: false, error: 'Busy; retry later' });

  try {
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    const spreadsheet = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) return jsonResponse({ success: false, error: 'No bound spreadsheet' });

    let sheet = spreadsheet.getSheetByName('Community Feedback');
    if (!sheet) sheet = spreadsheet.insertSheet('Community Feedback');

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 7).setValues([[
        'Timestamp', 'User Name', 'User Email', 'Star Rating (1-5)',
        'Category', 'Eco Tip / Suggestions', 'Submission ID',
      ]]);
    } else if (!sheet.getRange(1, 7).getValue()) {
      sheet.getRange(1, 7).setValue('Submission ID');
    }
    if (!sheet.isColumnHiddenByUser(7)) sheet.hideColumns(7);

    const lastRow = sheet.getLastRow();
    const existingIds = lastRow > 1
      ? new Set(sheet.getRange(2, 7, lastRow - 1, 1).getDisplayValues().flat())
      : new Set();
    const rowsToAppend = rows.filter((row) => !existingIds.has(row[6]));
    if (rowsToAppend.length) {
      sheet.getRange(lastRow + 1, 1, rowsToAppend.length, 7).setValues(rowsToAppend);
    }
    return jsonResponse({ success: true, inserted: rowsToAppend.length });
  } finally {
    lock.releaseLock();
  }
}

/** Public feed for the website. Only fields intended for public review display are returned. */
function doGet() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    const spreadsheet = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet && spreadsheet.getSheetByName('Community Feedback');
    if (!sheet || sheet.getLastRow() < 2) return jsonResponse({ success: true, feedbacks: [] });

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(6, sheet.getLastColumn())).getDisplayValues();
    const feedbacks = rows.map((row, index) => {
      const ratingMatch = String(row[3] || '').match(/[1-5]/);
      return {
        id: String(row[6] || `sheet-row-${index + 2}`),
        timestamp: String(row[0] || ''),
        name: String(row[1] || '').trim(),
        rating: ratingMatch ? Number(ratingMatch[0]) : 5,
        category: String(row[4] || 'Tip').trim(),
        comment: String(row[5] || '').trim(),
        upvotes: 0,
        syncedToSheet: true,
      };
    }).filter((feedback) => feedback.name && feedback.comment);

    return jsonResponse({ success: true, feedbacks });
  } catch (error) {
    return jsonResponse({ success: false, error: 'Could not read public feedback' });
  }
}

function appendLoginRecords(logins) {
  const rows = [];
  for (const login of logins) {
    const id = String(login.id || '').trim();
    const name = String(login.name || '').trim();
    const email = String(login.email || '').trim();
    const phone = String(login.phone || '').trim();
    const college = String(login.college || '').trim();
    if (!id || !name || !email || name.length > 120 || email.length > 254 || phone.length > 80 || college.length > 160) {
      return jsonResponse({ success: false, error: 'Invalid login record' });
    }
    rows.push([
      safeCell(String(login.timestamp || new Date().toISOString())),
      safeCell(name),
      safeCell(email),
      safeCell(phone),
      safeCell(college),
      '',
      id,
    ]);
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonResponse({ success: false, error: 'Busy; retry later' });
  try {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    const spreadsheet = spreadsheetId
      ? SpreadsheetApp.openById(spreadsheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) return jsonResponse({ success: false, error: 'No bound spreadsheet' });

    let sheet = spreadsheet.getSheetByName('User Logins');
    if (!sheet) sheet = spreadsheet.insertSheet('User Logins');
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 7).setValues([[
        'Login Time', 'Name', 'Email', 'Contact', 'Class / College', 'Session Identifier', 'Login Event ID',
      ]]);
    } else if (!sheet.getRange(1, 7).getValue()) {
      sheet.getRange(1, 7).setValue('Login Event ID');
    }
    if (!sheet.isColumnHiddenByUser(7)) sheet.hideColumns(7);

    const lastRow = sheet.getLastRow();
    const existingIds = lastRow > 1
      ? new Set(sheet.getRange(2, 7, lastRow - 1, 1).getDisplayValues().flat())
      : new Set();
    const newRows = rows.filter((row) => !existingIds.has(row[6]));
    if (newRows.length) sheet.getRange(lastRow + 1, 1, newRows.length, 7).setValues(newRows);
    return jsonResponse({ success: true, inserted: newRows.length });
  } finally {
    lock.releaseLock();
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Eco Tech AI')
    .addItem('Configure automatic feedback sync', 'configureFeedbackSync')
    .addToUi();
}

function configureFeedbackSync() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Configure automatic feedback sync',
    'Paste the private sync secret from the Render service settings. This links the web app to this spreadsheet.',
    ui.ButtonSet.OK_CANCEL,
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const secret = response.getResponseText().trim();
  if (secret.length < 32) {
    ui.alert('The sync secret must be at least 32 characters.');
    return;
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    ui.alert('Open this script from the Eco Tech AI spreadsheet, then try again.');
    return;
  }

  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    FEEDBACK_SYNC_SECRET: secret,
  }, false);
  ui.alert('The private spreadsheet connection is configured. You can now deploy the web app.');
}

function safeCell(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
