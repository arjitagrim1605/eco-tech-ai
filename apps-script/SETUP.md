# Google Sheets sync setup

This bound Apps Script receives visitor login details and feedback from the Eco Tech AI server. It writes login name, email, contact, class/college, and login time to `User Logins`. Public feedback fields are returned to the website for display; submitter emails and login details are never returned by the public endpoint.

1. Open the `Eco Tech AI - Master Data Hub` spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor's `Code.gs` contents with [`Code.gs`](./Code.gs), then save.
3. Create one long random private secret and keep it out of GitHub and messages. Add it to the Render service as `GOOGLE_SHEETS_WEBHOOK_SECRET` (leave the URL blank for now).
4. Reload the spreadsheet. From its **Eco Tech AI** menu, choose **Configure automatic feedback sync** and paste that same secret. This saves the secret and spreadsheet ID in Apps Script properties.
5. In Apps Script, choose **Deploy → Manage deployments**, edit the existing web app deployment, select **New version**, and deploy. Keep **Execute as** set to your account and **Who has access** set to **Anyone**. This updates both the private write endpoint and the public review feed.
6. In Render, confirm `GOOGLE_SHEETS_WEBHOOK_URL` contains the web app URL and `GOOGLE_SHEETS_WEBHOOK_SECRET` contains the private secret, then save/redeploy.

The server sends each login's name, email, contact, class/college, timestamp, and an internal deduplication ID. It never sends passwords. Feedback sync sends name, rating, category, comment, timestamp, and a deduplication ID, but not email. Event IDs are stored in hidden columns to prevent duplicate rows after retries.
