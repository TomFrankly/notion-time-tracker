import type { 
  TimerState, 
  Settings, 
  StartTimerPayload,
  Message 
} from '../popup/lib/types';
import { DEFAULT_TIMER_STATE } from '../popup/lib/types';

const STORAGE_KEYS = {
  SETTINGS: 'notion_time_tracker_settings',
  TIMER_STATE: 'notion_time_tracker_timer_state'
};

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Timer update interval (update badge every second when running)
const TIMER_ALARM_NAME = 'notion_time_tracker_tick';

/**
 * Make an authenticated request to Notion API
 */
async function notionRequest<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get settings from storage
 */
async function getSettings(): Promise<Settings | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      resolve(result[STORAGE_KEYS.SETTINGS] || null);
    });
  });
}

/**
 * Get timer state from storage
 */
async function getTimerState(): Promise<TimerState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.TIMER_STATE, (result) => {
      resolve(result[STORAGE_KEYS.TIMER_STATE] || DEFAULT_TIMER_STATE);
    });
  });
}

/**
 * Save timer state to storage
 */
async function saveTimerState(state: TimerState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.TIMER_STATE]: state }, resolve);
  });
}

/**
 * Update badge to show timer status
 */
function updateBadge(state: TimerState): void {
  if (state.isRunning) {
    // Show green badge when running
    chrome.action.setBadgeBackgroundColor({ color: '#2ecc71' });
    chrome.action.setBadgeText({ text: '▶' });
  } else if (state.isPaused) {
    // Show orange badge when paused
    chrome.action.setBadgeBackgroundColor({ color: '#f39c12' });
    chrome.action.setBadgeText({ text: '⏸' });
  } else {
    // Clear badge when stopped
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Database property info
 */
interface DatabasePropertyInfo {
  taskRelationName: string | null;
  titlePropertyName: string | null;
}

/**
 * Find the task relation property and title property names in work sessions database
 */
async function getWorkSessionsDbInfo(
  apiKey: string,
  workSessionsDbId: string,
  tasksDbId: string
): Promise<DatabasePropertyInfo> {
  interface DatabaseResponse {
    properties: Record<string, {
      id: string;
      name: string;
      type: string;
      relation?: { database_id: string };
    }>;
  }

  const db = await notionRequest<DatabaseResponse>(
    apiKey,
    `/databases/${workSessionsDbId}`
  );

  const relationProp = Object.values(db.properties).find(
    prop => prop.type === 'relation' && prop.relation?.database_id === tasksDbId
  );

  const titleProp = Object.values(db.properties).find(
    prop => prop.type === 'title'
  );

  return {
    taskRelationName: relationProp?.name || null,
    titlePropertyName: titleProp?.name || null
  };
}

/**
 * Count existing work sessions for a task
 */
async function getExistingSessionCount(
  apiKey: string,
  taskId: string,
  sessionsPropertyName: string
): Promise<number> {
  interface PageResponse {
    properties: Record<string, unknown>;
  }

  try {
    const page = await notionRequest<PageResponse>(apiKey, `/pages/${taskId}`);
    
    const sessionsProp = page.properties[sessionsPropertyName] as {
      relation?: Array<{ id: string }>;
    } | undefined;
    
    return sessionsProp?.relation?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Create a new work session in Notion
 */
async function createWorkSession(
  settings: Settings,
  taskId: string,
  taskTitle: string
): Promise<string> {
  const dbInfo = await getWorkSessionsDbInfo(
    settings.apiKey,
    settings.workSessionsDataSourceId,
    settings.tasksDataSourceId
  );

  if (!dbInfo.taskRelationName) {
    throw new Error('Could not find task relation property');
  }

  // Get existing session count to determine session number
  const existingCount = await getExistingSessionCount(
    settings.apiKey,
    taskId,
    settings.sessionsPropertyName
  );
  const sessionNumber = existingCount + 1;

  interface CreateResponse {
    id: string;
  }

  // Build properties object
  const properties: Record<string, unknown> = {
    [dbInfo.taskRelationName]: {
      relation: [{ id: taskId }]
    },
    [settings.startDatePropertyName]: {
      date: { start: new Date().toISOString() }
    }
  };

  // Add title property if we found it
  if (dbInfo.titlePropertyName) {
    properties[dbInfo.titlePropertyName] = {
      title: [
        {
          type: 'mention',
          mention: {
            type: 'page',
            page: { id: taskId }
          }
        },
        {
          type: 'text',
          text: { content: ` (Session ${sessionNumber})` }
        }
      ]
    };
  }

  const response = await notionRequest<CreateResponse>(
    settings.apiKey,
    '/pages',
    {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: settings.workSessionsDataSourceId },
        properties
      })
    }
  );

  return response.id;
}

/**
 * Update work session with end date
 */
async function endWorkSession(settings: Settings, sessionId: string): Promise<void> {
  await notionRequest(
    settings.apiKey,
    `/pages/${sessionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          [settings.endDatePropertyName]: {
            date: { start: new Date().toISOString() }
          }
        }
      })
    }
  );
}

/**
 * Handle START_TIMER message
 */
async function handleStartTimer(payload: StartTimerPayload): Promise<TimerState> {
  const settings = await getSettings();
  if (!settings) {
    throw new Error('Settings not configured');
  }

  // Create work session in Notion with task title for naming
  const sessionId = await createWorkSession(settings, payload.taskId, payload.taskTitle);

  const state: TimerState = {
    isRunning: true,
    isPaused: false,
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    currentSessionId: sessionId,
    sessionStartTime: Date.now(),
    previousTotal: payload.previousTotal
  };

  await saveTimerState(state);
  updateBadge(state);
  
  // Start tick alarm for badge updates
  chrome.alarms.create(TIMER_ALARM_NAME, { periodInMinutes: 1/60 }); // Every second

  return state;
}

/**
 * Handle PAUSE_TIMER message
 */
async function handlePauseTimer(): Promise<TimerState> {
  const settings = await getSettings();
  const state = await getTimerState();
  
  if (!settings || !state.isRunning || !state.currentSessionId) {
    return state;
  }

  // End the current work session in Notion
  await endWorkSession(settings, state.currentSessionId);

  // Calculate elapsed time for this session
  const sessionElapsed = state.sessionStartTime 
    ? Date.now() - state.sessionStartTime 
    : 0;

  const newState: TimerState = {
    ...state,
    isRunning: false,
    isPaused: true,
    currentSessionId: null,
    sessionStartTime: null,
    previousTotal: state.previousTotal + sessionElapsed
  };

  await saveTimerState(newState);
  updateBadge(newState);
  
  // Stop tick alarm
  chrome.alarms.clear(TIMER_ALARM_NAME);

  return newState;
}

/**
 * Handle RESUME_TIMER message
 */
async function handleResumeTimer(): Promise<TimerState> {
  const settings = await getSettings();
  const state = await getTimerState();
  
  if (!settings || !state.isPaused || !state.taskId) {
    return state;
  }

  // Create a new work session in Notion with task title for naming
  const sessionId = await createWorkSession(settings, state.taskId, state.taskTitle || 'Untitled');

  const newState: TimerState = {
    ...state,
    isRunning: true,
    isPaused: false,
    currentSessionId: sessionId,
    sessionStartTime: Date.now()
  };

  await saveTimerState(newState);
  updateBadge(newState);
  
  // Start tick alarm
  chrome.alarms.create(TIMER_ALARM_NAME, { periodInMinutes: 1/60 });

  return newState;
}

/**
 * Handle STOP_TIMER message
 */
async function handleStopTimer(): Promise<TimerState> {
  const settings = await getSettings();
  const state = await getTimerState();
  
  if (!settings) {
    await saveTimerState(DEFAULT_TIMER_STATE);
    updateBadge(DEFAULT_TIMER_STATE);
    return DEFAULT_TIMER_STATE;
  }

  // End current session if running
  if (state.isRunning && state.currentSessionId) {
    await endWorkSession(settings, state.currentSessionId);
  }

  await saveTimerState(DEFAULT_TIMER_STATE);
  updateBadge(DEFAULT_TIMER_STATE);
  
  // Stop tick alarm
  chrome.alarms.clear(TIMER_ALARM_NAME);

  return DEFAULT_TIMER_STATE;
}

/**
 * Handle GET_STATE message
 */
async function handleGetState(): Promise<{ timerState: TimerState }> {
  const state = await getTimerState();
  return { timerState: state };
}

// Message listener
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    const handleMessage = async (): Promise<unknown> => {
      try {
        switch (message.type) {
          case 'START_TIMER':
            return await handleStartTimer(message.payload as StartTimerPayload);
          case 'PAUSE_TIMER':
            return await handlePauseTimer();
          case 'RESUME_TIMER':
            return await handleResumeTimer();
          case 'STOP_TIMER':
            return await handleStopTimer();
          case 'GET_STATE':
            return await handleGetState();
          default:
            return { error: 'Unknown message type' };
        }
      } catch (error) {
        console.error('Service worker error:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    };

    handleMessage().then(sendResponse);
    return true; // Keep message channel open for async response
  }
);

// Alarm listener for badge updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TIMER_ALARM_NAME) {
    const state = await getTimerState();
    if (state.isRunning) {
      // Could update badge with elapsed time here if desired
      // For now, just ensure badge stays visible
      updateBadge(state);
    }
  }
});

// Initialize badge state on startup
chrome.runtime.onStartup.addListener(async () => {
  const state = await getTimerState();
  updateBadge(state);
  
  if (state.isRunning) {
    chrome.alarms.create(TIMER_ALARM_NAME, { periodInMinutes: 1/60 });
  }
});

// Initialize badge state on install
chrome.runtime.onInstalled.addListener(async () => {
  const state = await getTimerState();
  updateBadge(state);
});

console.log('Notion Time Tracker service worker initialized');
