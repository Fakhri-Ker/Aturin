"use strict";

const crypto = require("node:crypto");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const { onRequest } = require("firebase-functions/v2/https");

const GOOGLE_CLIENT_ID = defineSecret("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = defineSecret("GOOGLE_CLIENT_SECRET");
const APP_ORIGIN = "https://aturin-6a0d3.web.app";
const OAUTH_REDIRECT_URI = `${APP_ORIGIN}/api/calendar/callback`;
const OAUTH_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

if (!getApps().length) {
  initializeApp({
    databaseURL: "https://aturin-6a0d3-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}
const db = getDatabase();

function sendJson(res, status, value) {
  res.set("Cache-Control", "no-store");
  res.status(status).json(value);
}

function safeRedirect(res, result) {
  res.set("Cache-Control", "no-store");
  res.redirect(302, `${APP_ORIGIN}/?calendar=${encodeURIComponent(result)}`);
}

async function requireUser(req) {
  const match = (req.get("authorization") || "").match(/^Bearer (.+)$/i);
  if (!match) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  try {
    return await getAuth().verifyIdToken(match[1]);
  } catch {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
}

function googleCredentials() {
  const clientId = GOOGLE_CLIENT_ID.value();
  const clientSecret = GOOGLE_CLIENT_SECRET.value();
  if (!clientId || !clientSecret) {
    const error = new Error("Google Calendar is not configured.");
    error.status = 503;
    throw error;
  }
  return { clientId, clientSecret };
}

async function exchangeGoogleToken(parameters) {
  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...parameters
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Google authorization failed.");
    error.status = response.status === 400 ? 401 : 502;
    throw error;
  }
  return result;
}

async function googleApi(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers
    }
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Google Calendar request failed.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function refreshAccessToken(uid, connection) {
  if (!connection?.refreshToken) {
    const error = new Error("Google Calendar is not connected.");
    error.status = 409;
    throw error;
  }
  const token = await exchangeGoogleToken({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken
  });
  return token.access_token;
}

function taskTimestamp(task) {
  const value = Number(task.updatedAt);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function taskIdForEvent(eventId) {
  const digest = crypto.createHash("sha256").update(eventId).digest("hex").slice(0, 28);
  return `google_${digest}`;
}

function eventDateTimeParts(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${fields.year}-${fields.month}-${fields.day}`,
    time: `${fields.hour}:${fields.minute}`
  };
}

function recurrenceFromGoogle(event) {
  const recurrence = Array.isArray(event.recurrence) ? event.recurrence : [];
  const rules = recurrence.filter(line => line.startsWith("RRULE:"));
  const rule = rules.length === 1 ? rules[0].slice("RRULE:".length) : "";
  const match = rule.match(/(?:^|;)FREQ=(DAILY|WEEKLY|MONTHLY)(?:;|$)/);
  const simple = Boolean(match && rule === `FREQ=${match[1]}`);
  return {
    calendarRecurrence: recurrence.length ? recurrence : null,
    routine: Boolean(simple),
    recurrence: simple ? match[1].toLowerCase() : null
  };
}

function eventToTaskRecord(event, timeZone, previousTask, taskId) {
  if (!event.start || (!event.start.date && !event.start.dateTime)) return null;
  const allDay = Boolean(event.start.date);
  const parts = allDay ? { date: event.start.date, time: "" } : eventDateTimeParts(event.start.dateTime, timeZone);
  if (!parts || !/^\d{4}-\d{2}-\d{2}$/.test(parts.date)) return null;

  const startTime = event.start.dateTime ? new Date(event.start.dateTime).getTime() : 0;
  const endTime = event.end?.dateTime ? new Date(event.end.dateTime).getTime() : 0;
  const recurrence = recurrenceFromGoogle(event);
  return {
    ...(previousTask || {}),
    id: taskId,
    title: typeof event.summary === "string" && event.summary.trim()
      ? event.summary.trim().slice(0, 100)
      : "Acara tanpa judul",
    date: parts.date,
    time: parts.time,
    priority: previousTask?.priority || "normal",
    completed: previousTask?.completed || false,
    completedDates: previousTask?.completedDates || [],
    routine: recurrence.routine,
    recurrence: recurrence.recurrence,
    reminder: previousTask?.reminder || "none",
    calendarEventId: event.id,
    calendarRecurrence: recurrence.calendarRecurrence,
    calendarDurationMinutes: startTime && endTime
      ? Math.max(1, Math.round((endTime - startTime) / 60_000))
      : 1440,
    calendarTimeZone: timeZone,
    calendarDescription: event.description || "",
    calendarLocation: event.location || "",
    updatedAt: Date.parse(event.updated || "") || Date.now()
  };
}

function addMinutesToDateTime(date, time, minutes) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  const pad = number => String(number).padStart(2, "0");
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:00`;
}

function buildGoogleEvent(task, timeZone) {
  const duration = Number.isInteger(task.calendarDurationMinutes) && task.calendarDurationMinutes > 0
    ? task.calendarDurationMinutes
    : 30;
  const event = {
    summary: task.title,
    description: task.calendarDescription || "",
    location: task.calendarLocation || "",
    extendedProperties: { private: { aturinTaskId: task.id } }
  };

  if (task.time) {
    const eventTimeZone = task.calendarTimeZone || timeZone;
    event.start = { dateTime: `${task.date}T${task.time}:00`, timeZone: eventTimeZone };
    event.end = { dateTime: addMinutesToDateTime(task.date, task.time, duration), timeZone: eventTimeZone };
  } else {
    const [year, month, day] = task.date.split("-").map(Number);
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    const pad = number => String(number).padStart(2, "0");
    event.start = { date: task.date };
    event.end = {
      date: `${nextDay.getUTCFullYear()}-${pad(nextDay.getUTCMonth() + 1)}-${pad(nextDay.getUTCDate())}`
    };
  }

  if (Array.isArray(task.calendarRecurrence) && task.calendarRecurrence.length) {
    event.recurrence = task.calendarRecurrence;
  } else if (task.recurrence) {
    event.recurrence = [`RRULE:FREQ=${task.recurrence.toUpperCase()}`];
  }
  return event;
}

function googleEventIdForTask(uid, taskId) {
  return crypto.createHash("sha256").update(`${uid}:${taskId}`).digest("hex");
}

async function createGoogleEvent(accessToken, uid, task, timeZone) {
  const event = buildGoogleEvent(task, timeZone);
  event.id = googleEventIdForTask(uid, task.id);
  const url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  try {
    return await googleApi(accessToken, url, {
      method: "POST",
      body: JSON.stringify(event)
    });
  } catch (error) {
    if (error.status !== 409) throw error;
    const existing = await googleApi(accessToken, `${url}/${event.id}`);
    if (existing.extendedProperties?.private?.aturinTaskId !== task.id) throw error;
    return existing;
  }
}

async function fetchCalendarChanges(accessToken, syncToken) {
  const items = [];
  let pageToken = null;
  let nextSyncToken = null;
  do {
    const query = new URLSearchParams({ maxResults: "2500", showDeleted: "true" });
    if (syncToken) query.set("syncToken", syncToken);
    if (pageToken) query.set("pageToken", pageToken);
    const page = await googleApi(
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`
    );
    if (Array.isArray(page.items)) items.push(...page.items);
    pageToken = page.nextPageToken || null;
    nextSyncToken = page.nextSyncToken || nextSyncToken;
  } while (pageToken);
  return { items, nextSyncToken };
}

function taskRecordsFromDatabase(value) {
  const records = value?.tasks && typeof value.tasks === "object" ? value.tasks : value;
  if (!records || typeof records !== "object") return {};
  const tasks = {};
  for (const [key, task] of Object.entries(records)) {
    if (!task || typeof task !== "object" || Array.isArray(task)) continue;
    const id = typeof task.id === "string" && task.id ? task.id : key;
    if (typeof task.title !== "string" || !task.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(task.date || "")) {
      const error = new Error("A task has invalid required fields.");
      error.status = 409;
      throw error;
    }
    tasks[id] = { ...task, id };
  }
  return tasks;
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > 100) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

async function startOAuth(req, res, user) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  const { clientId } = googleCredentials();
  const state = crypto.randomBytes(32).toString("hex");
  await db.ref(`privateCalendarOAuthStates/${state}`).set({
    uid: user.uid,
    expiresAt: Date.now() + 10 * 60_000
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state
  }).toString();
  return sendJson(res, 200, { authorizationUrl: url.toString() });
}

async function finishOAuth(req, res) {
  if (req.method !== "GET") return safeRedirect(res, "error");
  if (req.query.error) return safeRedirect(res, "denied");
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !/^[a-f0-9]{64}$/.test(state)) return safeRedirect(res, "error");

  const stateRef = db.ref(`privateCalendarOAuthStates/${state}`);
  let stateRecord = null;
  const transaction = await stateRef.transaction(current => {
    if (!current || current.expiresAt < Date.now()) return;
    stateRecord = current;
    return null;
  });
  if (!transaction.committed || !stateRecord?.uid) return safeRedirect(res, "expired");

  try {
    const token = await exchangeGoogleToken({
      code,
      grant_type: "authorization_code",
      redirect_uri: OAUTH_REDIRECT_URI
    });
    const connectionRef = db.ref(`privateCalendarConnections/${stateRecord.uid}`);
    const previous = (await connectionRef.once("value")).val() || {};
    const refreshToken = token.refresh_token || previous.refreshToken;
    if (!refreshToken) return safeRedirect(res, "error");

    let googleEmail = previous.googleEmail || "";
    if (token.access_token) {
      try {
        const profile = await googleApi(token.access_token, "https://www.googleapis.com/oauth2/v2/userinfo");
        googleEmail = typeof profile.email === "string" ? profile.email : googleEmail;
      } catch {
        logger.warn("Calendar account email could not be retrieved.");
      }
    }
    await connectionRef.set({ refreshToken, googleEmail, connectedAt: Date.now() });
    return safeRedirect(res, "connected");
  } catch (error) {
    logger.error("Google Calendar OAuth callback failed.", { status: error.status || 500 });
    return safeRedirect(res, "error");
  }
}

async function syncCalendar(req, res, user) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  const timeZone = validTimeZone(req.body?.timeZone);
  const lockId = crypto.randomBytes(16).toString("hex");
  const lockRef = db.ref(`privateCalendarSyncLocks/${user.uid}`);
  const lock = await lockRef.transaction(current =>
    !current || current.expiresAt < Date.now() ? { id: lockId, expiresAt: Date.now() + 10 * 60_000 } : undefined
  );
  if (!lock.committed) return sendJson(res, 409, { error: "sync_in_progress" });

  try {
    const [connectionSnapshot, tasksSnapshot, syncSnapshot] = await Promise.all([
      db.ref(`privateCalendarConnections/${user.uid}`).once("value"),
      db.ref(`users/${user.uid}/tasks`).once("value"),
      db.ref(`privateCalendarSync/${user.uid}`).once("value")
    ]);
    const connection = connectionSnapshot.val();
    const accessToken = await refreshAccessToken(user.uid, connection);
    const tasks = taskRecordsFromDatabase(tasksSnapshot.val());
    const previousSync = syncSnapshot.val() || {};
    const sameGoogleAccount = !previousSync.googleEmail || !connection.googleEmail
      || previousSync.googleEmail.toLowerCase() === connection.googleEmail.toLowerCase();
    const eventToTask = sameGoogleAccount ? { ...(previousSync.eventToTask || {}) } : {};
    const taskToEvent = sameGoogleAccount ? { ...(previousSync.taskToEvent || {}) } : {};
    let syncToken = sameGoogleAccount ? previousSync.syncToken || null : null;

    let changes;
    let fullResync = false;
    try {
      changes = await fetchCalendarChanges(accessToken, syncToken);
    } catch (error) {
      if (error.status !== 410 || !syncToken) throw error;
      syncToken = null;
      fullResync = true;
      changes = await fetchCalendarChanges(accessToken, null);
    }

    let imported = 0;
    let updated = 0;
    let removed = 0;
    let uploaded = 0;
    const changedEvents = new Map(changes.items.filter(event => event.id).map(event => [event.id, event]));

    if (fullResync) {
      const activeEventIds = new Set(
        changes.items.filter(event => event.status !== "cancelled").map(event => event.id)
      );
      for (const [eventId, mapping] of Object.entries(eventToTask)) {
        if (activeEventIds.has(eventId)) continue;
        const taskId = mapping.taskId;
        const task = tasks[taskId];
        if (task && taskTimestamp(task) > Number(mapping.googleUpdatedAt || 0)) {
          const replacement = await createGoogleEvent(accessToken, user.uid, task, timeZone);
          delete eventToTask[eventId];
          eventToTask[replacement.id] = {
            taskId,
            googleUpdatedAt: Date.parse(replacement.updated || "") || Date.now()
          };
          taskToEvent[taskId] = replacement.id;
          updated += 1;
        } else {
          if (task) {
            delete tasks[taskId];
            removed += 1;
          }
          delete taskToEvent[taskId];
          delete eventToTask[eventId];
        }
      }
    }

    for (const event of changedEvents.values()) {
      let mapping = eventToTask[event.id];
      const taggedTaskId = event.extendedProperties?.private?.aturinTaskId;
      if (!mapping && taggedTaskId && tasks[taggedTaskId]) {
        mapping = { taskId: taggedTaskId, googleUpdatedAt: 0 };
        eventToTask[event.id] = mapping;
        taskToEvent[taggedTaskId] = event.id;
      }

      const eventUpdatedAt = Date.parse(event.updated || "") || Date.now();
      const taskId = mapping?.taskId || taskIdForEvent(event.id);
      const existingTask = tasks[taskId];

      if (event.status === "cancelled") {
        if (existingTask && taskTimestamp(existingTask) > eventUpdatedAt) {
          const replacement = await createGoogleEvent(accessToken, user.uid, existingTask, timeZone);
          delete eventToTask[event.id];
          eventToTask[replacement.id] = {
            taskId,
            googleUpdatedAt: Date.parse(replacement.updated || "") || Date.now()
          };
          taskToEvent[taskId] = replacement.id;
          updated += 1;
        } else {
          if (existingTask) {
            delete tasks[taskId];
            delete taskToEvent[taskId];
            removed += 1;
          }
          delete eventToTask[event.id];
        }
        continue;
      }

      if (!mapping && !existingTask) {
        const importedTask = eventToTask[event.id] = {
          taskId,
          googleUpdatedAt: eventUpdatedAt
        };
        const taskRecord = eventToTaskRecord(event, timeZone, null, importedTask.taskId);
        if (!taskRecord) {
          delete eventToTask[event.id];
          continue;
        }
        tasks[taskId] = taskRecord;
        taskToEvent[taskId] = event.id;
        imported += 1;
        continue;
      }

      if (!existingTask) {
        await googleApi(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.id)}`,
          { method: "DELETE" }
        ).catch(error => {
          if (error.status !== 404 && error.status !== 410) throw error;
        });
        delete eventToTask[event.id];
        delete taskToEvent[taskId];
        removed += 1;
        continue;
      }

      if (taskTimestamp(existingTask) > eventUpdatedAt) {
        const patched = await googleApi(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.id)}`,
          { method: "PATCH", body: JSON.stringify(buildGoogleEvent(existingTask, timeZone)) }
        );
        eventToTask[event.id] = {
          taskId,
          googleUpdatedAt: Date.parse(patched.updated || "") || Date.now()
        };
        updated += 1;
      } else {
        const taskRecord = eventToTaskRecord(event, timeZone, existingTask, taskId);
        if (!taskRecord) continue;
        tasks[taskId] = taskRecord;
        eventToTask[event.id] = { taskId, googleUpdatedAt: eventUpdatedAt };
        updated += 1;
      }
      taskToEvent[taskId] = event.id;
    }

    for (const [taskId, eventId] of Object.entries({ ...taskToEvent })) {
      if (tasks[taskId]) continue;
      await googleApi(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" }
      ).catch(error => {
        if (error.status !== 404 && error.status !== 410) throw error;
      });
      delete taskToEvent[taskId];
      delete eventToTask[eventId];
      removed += 1;
    }

    for (const [taskId, task] of Object.entries(tasks)) {
      const eventId = taskToEvent[taskId];
      if (!eventId) {
        if (!task.calendarTimeZone) task.calendarTimeZone = timeZone;
        const created = await createGoogleEvent(accessToken, user.uid, task, timeZone);
        taskToEvent[taskId] = created.id;
        eventToTask[created.id] = {
          taskId,
          googleUpdatedAt: Date.parse(created.updated || "") || Date.now()
        };
        uploaded += 1;
        continue;
      }

      const mapping = eventToTask[eventId];
      if (mapping && taskTimestamp(task) > Number(mapping.googleUpdatedAt || 0)) {
        const updatedEvent = await googleApi(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
          { method: "PATCH", body: JSON.stringify(buildGoogleEvent(task, timeZone)) }
        );
        eventToTask[eventId] = {
          taskId,
          googleUpdatedAt: Date.parse(updatedEvent.updated || "") || Date.now()
        };
        uploaded += 1;
      }
    }

    const taskData = Object.keys(tasks).length ? tasks : null;
    await db.ref().update({
      [`users/${user.uid}/tasks`]: taskData,
      [`privateCalendarSync/${user.uid}`]: {
        eventToTask,
        taskToEvent,
        googleEmail: connection.googleEmail || null,
        syncToken: changes.nextSyncToken || syncToken || null,
        lastSyncedAt: Date.now()
      }
    });

    return sendJson(res, 200, { imported, updated, removed, uploaded, connected: true });
  } finally {
    await lockRef.transaction(current => current?.id === lockId ? null : undefined);
  }
}

exports.calendarApi = onRequest({
  region: "us-central1",
  timeoutSeconds: 300,
  memory: "512MiB",
  secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]
}, async (req, res) => {
  const path = req.path.replace(/\/+$/, "");
  if (path.endsWith("/callback")) return finishOAuth(req, res);

  try {
    const user = await requireUser(req);
    if (path.endsWith("/connect")) return await startOAuth(req, res, user);
    if (path.endsWith("/status")) {
      if (req.method !== "GET") return sendJson(res, 405, { error: "method_not_allowed" });
      const connection = (await db.ref(`privateCalendarConnections/${user.uid}`).once("value")).val();
      return sendJson(res, 200, {
        connected: Boolean(connection?.refreshToken),
        googleEmail: connection?.googleEmail || null
      });
    }
    if (path.endsWith("/sync")) return await syncCalendar(req, res, user);
    if (path.endsWith("/disconnect")) {
      if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
      const connectionRef = db.ref(`privateCalendarConnections/${user.uid}`);
      const connection = (await connectionRef.once("value")).val();
      if (connection?.refreshToken) {
        try {
          await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: connection.refreshToken })
          });
        } catch {
          logger.warn("Google Calendar token revocation request failed.");
        }
      }
      await connectionRef.remove();
      return sendJson(res, 200, { connected: false });
    }
    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) logger.error("Calendar API request failed.", { path, status });
    return sendJson(res, status, {
      error: status === 401 ? "unauthorized"
        : status === 409 ? "conflict"
          : status === 503 ? "not_configured"
            : status >= 500 ? "calendar_service_error"
              : "request_failed"
    });
  }
});
