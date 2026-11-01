/**
 * Bind this script to the Eco Tech AI - Master Data Hub spreadsheet.
 * Set the FEEDBACK_SYNC_SECRET script property before deploying as a web app.
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
