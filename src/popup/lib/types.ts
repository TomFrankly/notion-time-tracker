// Theme types
export type Theme = 'light' | 'dark' | 'system';

// View types
export type View = 'tasks' | 'timer' | 'settings';

// Settings types
export interface Settings {
  apiKey: string;
  tasksDataSourceId: string;
  tasksDataSourceName: string;
  statusPropertyId: string;
  statusPropertyName: string;
  sessionsPropertyId: string;
  sessionsPropertyName: string;
  workSessionsDataSourceId: string;
  workSessionsDataSourceName: string;
  startDatePropertyId: string;
  startDatePropertyName: string;
  endDatePropertyId: string;
  endDatePropertyName: string;
  theme: Theme;
  filters: TaskFilter[];
}

export interface TaskFilter {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyType: 'status' | 'checkbox';
  value: string | boolean;
}

// Timer state types
export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  taskId: string | null;
  taskTitle: string;
  currentSessionId: string | null;
  sessionStartTime: number | null;
  previousTotal: number;
}

// Notion types
export interface NotionDatabase {
  id: string;
  title: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionProperty {
  id: string;
  name: string;
  type: string;
  status?: {
    options: NotionStatusOption[];
  };
  relation?: {
    database_id: string;
    synced_property_name?: string;
  };
}

export interface NotionStatusOption {
  id: string;
  name: string;
  color: string;
}

export interface NotionTask {
  id: string;
  title: string;
  status: {
    name: string;
    color: string;
  } | null;
  sessionsRelation: string[];
  totalTrackedTime: number;
  lastEditedTime: string;
  activeSession: {
    id: string;
    startTime: number; // Unix timestamp
  } | null;
}

export interface NotionWorkSession {
  id: string;
  taskId: string;
  startDate: string | null;
  endDate: string | null;
}

// Message types for service worker communication
export type MessageType =
  | 'START_TIMER'
  | 'PAUSE_TIMER'
  | 'RESUME_TIMER'
  | 'STOP_TIMER'
  | 'GET_STATE'
  | 'STATE_UPDATE'
  | 'SETTINGS_UPDATE';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface StartTimerPayload {
  taskId: string;
  taskTitle: string;
  previousTotal: number;
}

export interface StateUpdatePayload {
  timerState: TimerState;
}

// Cached data
export interface CachedData {
  tasks: NotionTask[];
  lastFetched: number | null;
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  tasksDataSourceId: '',
  tasksDataSourceName: '',
  statusPropertyId: '',
  statusPropertyName: '',
  sessionsPropertyId: '',
  sessionsPropertyName: '',
  workSessionsDataSourceId: '',
  workSessionsDataSourceName: '',
  startDatePropertyId: '',
  startDatePropertyName: '',
  endDatePropertyId: '',
  endDatePropertyName: '',
  theme: 'system',
  filters: []
};

export const DEFAULT_CACHED_DATA: CachedData = {
  tasks: [],
  lastFetched: null
};

export const DEFAULT_TIMER_STATE: TimerState = {
  isRunning: false,
  isPaused: false,
  taskId: null,
  taskTitle: '',
  currentSessionId: null,
  sessionStartTime: null,
  previousTotal: 0
};
