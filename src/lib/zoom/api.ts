type ZoomTokenResponse = {
  access_token: string;
  expires_in: number;
};

type ZoomMeetingResponse = {
  id: number | string;
  uuid?: string;
  host_id?: string;
  host_email?: string;
  topic: string;
  start_url?: string;
  join_url?: string;
  password?: string;
  settings?: Record<string, unknown>;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export function hasZoomRestConfig() {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID
      && process.env.ZOOM_SERVER_CLIENT_ID
      && process.env.ZOOM_SERVER_CLIENT_SECRET
      && process.env.ZOOM_HOST_USER_ID
  );
}

async function getZoomAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_SERVER_CLIENT_ID;
  const clientSecret = process.env.ZOOM_SERVER_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom REST API credentials are not configured");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Zoom token request failed: ${await response.text()}`);
  }

  const data = await response.json() as ZoomTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(data.expires_in - 60, 60) * 1000,
  };
  return cachedToken.token;
}

export async function createZoomMeeting({
  topic,
  startsAt,
  durationMinutes,
  timezone,
  agenda,
}: {
  topic: string;
  startsAt: string;
  durationMinutes: number;
  timezone: string;
  agenda?: string;
}) {
  const hostUserId = process.env.ZOOM_HOST_USER_ID;
  if (!hostUserId) throw new Error("ZOOM_HOST_USER_ID is not configured");

  const token = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: topic.slice(0, 200),
      type: 2,
      start_time: startsAt,
      duration: durationMinutes,
      timezone,
      agenda: agenda?.slice(0, 2000),
      settings: {
        waiting_room: true,
        join_before_host: false,
        mute_upon_entry: true,
        participant_video: true,
        host_video: true,
        approval_type: 2,
        audio: "both",
        auto_recording: "none",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoom meeting creation failed: ${await response.text()}`);
  }

  return await response.json() as ZoomMeetingResponse;
}

