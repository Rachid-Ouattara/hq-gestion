import { google } from 'googleapis';
import { config } from '../config/index.js';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/userinfo.email'];

function client() {
  return new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUri);
}

export function isGoogleConfigured() {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
}

export function getAuthUrl(state) {
  return client().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

export async function exchangeCode(code) {
  const oauth2Client = client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
  const { data } = await oauth2.userinfo.get();
  return { refreshToken: tokens.refresh_token, email: data.email };
}

/** Crée un événement Calendar avec visioconférence Google Meet et le renvoie.
 * `guestsCanSeeOtherGuests: false` : les candidats d'un entretien groupé ne
 * doivent pas voir les coordonnées des autres candidats invités. */
export async function createMeetEvent({ refreshToken, summary, description, startDateTime, endDateTime, attendeeEmails }) {
  const oauth2Client = client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      attendees: attendeeEmails.map((email) => ({ email })),
      guestsCanSeeOtherGuests: false,
      conferenceData: {
        createRequest: {
          requestId: `hq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  return { eventId: data.id, meetLink: data.hangoutLink };
}
