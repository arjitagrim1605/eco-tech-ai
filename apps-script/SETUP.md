# Automatic feedback sync setup

This bound Apps Script receives feedback from the Eco Tech AI server and appends it to the `Community Feedback` tab. It does not receive submitters' email addresses or any Google sign-in token.

1. Open the `Eco Tech AI - Master Data Hub` spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor's `Code.gs` contents with [`Code.gs`](./Code.gs), then save.
3. Create one long random private secret and keep it out of GitHub and messages. Add it to the Render service as `GOOGLE_SHEETS_WEBHOOK_SECRET` (leave the URL blank for now).
4. Reload the spreadsheet. From its **Eco Tech AI** menu, choose **Configure automatic feedback sync** and paste that same secret. This saves the secret and spreadsheet ID in Apps Script properties.
5. In Apps Script, choose **Deploy → New deployment → Web app**. Set **Execute as** to your account and **Who has access** to **Anyone**, then deploy and copy the web app URL. The URL is public, but requests without the private secret are rejected.
6. In Render, add `GOOGLE_SHEETS_WEBHOOK_URL` with that URL and save/redeploy the service.

The server sends each new feedback's name, rating, category, comment, timestamp, and an internal deduplication ID. It does not send email. The ID is stored in a hidden column in the sheet so retries do not create duplicate rows.
