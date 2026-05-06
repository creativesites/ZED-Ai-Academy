"use server";

import { getData } from "@/data/getToken";

/**
 * Server action to generate a Zoom Video SDK JWT for a given session name.
 */
export async function getVideoToken(sessionName: string) {
  try {
    const token = await getData(sessionName);
    return { token };
  } catch (error) {
    console.error("Failed to generate Video SDK token:", error);
    return { error: "Failed to generate security token" };
  }
}
