"use server";

import { getData } from "@/data/getToken";

/**
 * Server action to generate a Zoom Video SDK JWT for a given session name.
 * Returns debug info to help troubleshoot configuration issues.
 */
export async function getVideoToken(sessionName: string) {
  const debugInfo = {
    hasClientId: !!process.env.ZOOM_CLIENT_ID,
    hasClientSecret: !!process.env.ZOOM_CLIENT_SECRET,
    sessionName,
    timestamp: new Date().toISOString(),
  };

  try {
    if (!debugInfo.hasClientId || !debugInfo.hasClientSecret) {
      return { 
        error: "Missing Zoom Credentials on Server", 
        debugInfo 
      };
    }

    const token = await getData(sessionName);
    return { token, debugInfo };
  } catch (error) {
    console.error("Failed to generate Video SDK token:", error);
    return { 
      error: error instanceof Error ? error.message : "Unknown server error", 
      debugInfo 
    };
  }
}
