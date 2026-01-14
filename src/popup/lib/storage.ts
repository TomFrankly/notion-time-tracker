import { DEFAULT_SETTINGS, DEFAULT_TIMER_STATE, DEFAULT_CACHED_DATA } from './types';
import type { Settings, TimerState, CachedData, NotionTask } from './types';

const STORAGE_KEYS = {
  SETTINGS: 'notion_time_tracker_settings',
  TIMER_STATE: 'notion_time_tracker_timer_state',
  CACHED_DATA: 'notion_time_tracker_cached_data'
} as const;

/**
 * Get settings from Chrome storage
 */
export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      const settings = result[STORAGE_KEYS.SETTINGS];
      console.log('Loading settings from storage:', {
        found: !!settings,
        hasApiKey: !!settings?.apiKey,
        tasksDbId: settings?.tasksDataSourceId,
        filtersCount: settings?.filters?.length || 0
      });
      if (settings) {
        // Ensure filters is always an array
        const merged = { 
          ...DEFAULT_SETTINGS, 
          ...settings,
          filters: Array.isArray(settings.filters) ? settings.filters : []
        };
        resolve(merged);
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

/**
 * Save settings to Chrome storage
 */
export async function saveSettings(settings: Settings): Promise<void> {
  console.log('Saving settings to storage:', { 
    hasApiKey: !!settings.apiKey,
    tasksDbId: settings.tasksDataSourceId,
    filtersCount: settings.filters?.length || 0
  });
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
      console.log('Settings saved successfully');
      resolve();
    });
  });
}

/**
 * Update specific settings fields
 */
export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await saveSettings(updated);
  return updated;
}

/**
 * Get timer state from Chrome storage
 */
export async function getTimerState(): Promise<TimerState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.TIMER_STATE, (result) => {
      const state = result[STORAGE_KEYS.TIMER_STATE];
      resolve(state ? { ...DEFAULT_TIMER_STATE, ...state } : DEFAULT_TIMER_STATE);
    });
  });
}

/**
 * Save timer state to Chrome storage
 */
export async function saveTimerState(state: TimerState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.TIMER_STATE]: state }, () => {
      resolve();
    });
  });
}

/**
 * Update specific timer state fields
 */
export async function updateTimerState(updates: Partial<TimerState>): Promise<TimerState> {
  const current = await getTimerState();
  const updated = { ...current, ...updates };
  await saveTimerState(updated);
  return updated;
}

/**
 * Clear timer state (reset to default)
 */
export async function clearTimerState(): Promise<void> {
  await saveTimerState(DEFAULT_TIMER_STATE);
}

/**
 * Listen for storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes);
    }
  };
  
  chrome.storage.onChanged.addListener(listener);
  
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Check if settings are configured
 */
export function isSettingsConfigured(settings: Settings): boolean {
  return !!(
    settings.apiKey &&
    settings.tasksDataSourceId &&
    settings.statusPropertyId &&
    settings.sessionsPropertyId &&
    settings.workSessionsDataSourceId &&
    settings.startDatePropertyId &&
    settings.endDatePropertyId
  );
}

/**
 * Get cached data from Chrome storage
 */
export async function getCachedData(): Promise<CachedData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.CACHED_DATA, (result) => {
      const data = result[STORAGE_KEYS.CACHED_DATA];
      if (data) {
        resolve({
          ...DEFAULT_CACHED_DATA,
          ...data,
          tasks: Array.isArray(data.tasks) ? data.tasks : []
        });
      } else {
        resolve(DEFAULT_CACHED_DATA);
      }
    });
  });
}

/**
 * Save cached data to Chrome storage
 */
export async function saveCachedData(data: CachedData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.CACHED_DATA]: data }, () => {
      resolve();
    });
  });
}

/**
 * Save cached tasks
 */
export async function saveCachedTasks(tasks: NotionTask[]): Promise<void> {
  const data: CachedData = {
    tasks,
    lastFetched: Date.now()
  };
  await saveCachedData(data);
}

/**
 * Get cached tasks
 */
export async function getCachedTasks(): Promise<NotionTask[]> {
  const data = await getCachedData();
  return data.tasks;
}
