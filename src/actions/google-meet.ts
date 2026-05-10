"use server";

import { GoogleAuth } from 'google-auth-library';
import path from 'node:path';

/**
 * The scope for creating calendar events with Google Meet links.
 */
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

/**
 * Path to the Service Account JSON file.
 */
const SERVICE_ACCOUNT_PATH = path.join(process.cwd(), 'google', 'service-account.json');

/**
 * Creates a new meeting space via the Google Calendar API.
 * This is the most reliable way to generate a Google Meet link.
 */
export async function createMeetSpace() {
  try {
    console.log('Initializing Google Auth for Calendar API...');
    
    const auth = new GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: SCOPES,
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    if (!token) {
      throw new Error("Failed to retrieve Google Access Token");
    }

    console.log('Creating Calendar Event with Google Meet link...');
    
    // We create a "quick" event that starts now and ends in 1 hour
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);

    const event = {
      summary: 'AI Academy Teaching Session',
      description: 'Live studio session for ZED AI Academy.',
      start: {
        dateTime: now.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'UTC',
      },
      conferenceData: {
        createRequest: {
          requestId: `zed-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    // Note: conferenceDataVersion=1 is REQUIRED to generate the Meet link
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Calendar API Error:', data);
      
      if (data.error?.message?.includes('Not Found')) {
        throw new Error("Calendar 'primary' not found. Ensure the Service Account has a calendar or use a specific calendar ID.");
      }
      
      throw new Error(data.error?.message || `HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    // The Meet link is in the hangoutLink field
    const meetingUri = data.hangoutLink;

    if (!meetingUri) {
      console.error('No hangoutLink in response:', data);
      throw new Error("Calendar event created, but no Google Meet link was generated. Check API permissions.");
    }

    console.log('Google Meet link generated:', meetingUri);

    return { 
      success: true, 
      meetingUri,
      eventId: data.id 
    };
  } catch (error: any) {
    console.error('Google Calendar API error detail:', error);
    return { 
      success: false, 
      error: error?.message || "Failed to create meeting. Ensure Google Calendar API is enabled."
    };
  }
}
