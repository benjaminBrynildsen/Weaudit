/**
 * Google Drive backup via OAuth 2.0 + Drive API v3.
 *
 * Requires:
 * 1. A Google Cloud project with the Drive API enabled
 * 2. An OAuth 2.0 client ID (Web application type)
 * 3. Authorized JavaScript origins set to your app's URL
 * 4. The client ID set in VITE_GOOGLE_CLIENT_ID env var
 */

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

let cachedToken: string | null = null;

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error(
      "Missing VITE_GOOGLE_CLIENT_ID. Add it to your .env file with your Google OAuth client ID.",
    );
  }
  return id;
}

/**
 * Request an OAuth access token via Google Identity Services popup.
 * Caches the token for the session so the user only has to approve once.
 */
function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (cachedToken) {
      resolve(cachedToken);
      return;
    }

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services not loaded. Check your internet connection."));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        cachedToken = response.access_token;
        // Token expires — clear cache after expiry
        setTimeout(() => { cachedToken = null; }, (response.expires_in || 3600) * 1000);
        resolve(response.access_token);
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Upload a CSV string to Google Drive as a file.
 * Returns the web view link so the user can open it.
 */
export async function uploadToDrive(
  fileName: string,
  csvContent: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const token = await requestAccessToken();

  const metadata = {
    name: fileName,
    mimeType: "text/csv",
  };

  const boundary = "weaudit_boundary_" + Date.now();
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: text/csv",
    "",
    csvContent,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(`${DRIVE_UPLOAD_URL}&fields=id,webViewLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    // If auth expired, clear cache and let user retry
    if (res.status === 401) cachedToken = null;
    throw new Error(`Drive upload failed (${res.status}): ${err}`);
  }

  return res.json();
}
