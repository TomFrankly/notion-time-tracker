import { writable, derived, get } from 'svelte/store';
import { getSettings, getTimerState, saveSettings, onStorageChange, getCachedTasks, saveCachedTasks } from './storage';
import { DEFAULT_SETTINGS, DEFAULT_TIMER_STATE } from './types';
import type { Settings, TimerState, View, Theme, NotionTask } from './types';

// Current view store
export const currentView = writable<View>('tasks');

// Settings store
export const settings = writable<Settings>(DEFAULT_SETTINGS);

// Timer state store
export const timerState = writable<TimerState>(DEFAULT_TIMER_STATE);

// Cached tasks store
export const cachedTasks = writable<NotionTask[]>([]);

// Loading states
export const isLoading = writable<boolean>(true);
export const isSaving = writable<boolean>(false);

// Error state
export const errorMessage = writable<string | null>(null);

// Derived store for whether settings are configured
export const isConfigured = derived(settings, ($settings) => {
  return !!(
    $settings.apiKey &&
    $settings.tasksDataSourceId &&
    $settings.statusPropertyId &&
    $settings.sessionsPropertyId &&
    $settings.workSessionsDataSourceId &&
    $settings.startDatePropertyId &&
    $settings.endDatePropertyId
  );
});

// Derived store for current theme (resolved from system if needed)
export const resolvedTheme = derived(settings, ($settings) => {
  if ($settings.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return $settings.theme;
});

// Initialize stores from storage
export async function initializeStores(): Promise<void> {
  isLoading.set(true);
  try {
    const [savedSettings, savedTimerState, savedTasks] = await Promise.all([
      getSettings(),
      getTimerState(),
      getCachedTasks()
    ]);
    
    // Ensure filters is always an array
    const normalizedSettings = {
      ...savedSettings,
      filters: Array.isArray(savedSettings.filters) ? savedSettings.filters : []
    };
    
    settings.set(normalizedSettings);
    timerState.set(savedTimerState);
    cachedTasks.set(savedTasks);
    
    // Check if timer is active, switch to timer view
    if (savedTimerState.taskId && (savedTimerState.isRunning || savedTimerState.isPaused)) {
      currentView.set('timer');
    }
  } catch (error) {
    console.error('Failed to initialize stores:', error);
    errorMessage.set('Failed to load settings');
  } finally {
    isLoading.set(false);
  }
}

// Update cached tasks
export async function updateCachedTasks(tasks: NotionTask[]): Promise<void> {
  cachedTasks.set(tasks);
  await saveCachedTasks(tasks);
}

// Update settings store and persist
export async function updateSettingsStore(updates: Partial<Settings>): Promise<void> {
  isSaving.set(true);
  try {
    const current = get(settings);
    const updated = { ...current, ...updates };
    await saveSettings(updated);
    settings.set(updated);
  } catch (error) {
    console.error('Failed to save settings:', error);
    errorMessage.set('Failed to save settings');
  } finally {
    isSaving.set(false);
  }
}

// Initialize theme on page load
export function initTheme(): void {
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('notion_time_tracker_theme') as Theme | null;
  
  function applyTheme(theme: Theme) {
    const isDark = theme === 'dark' || 
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    document.documentElement.classList.toggle('dark', isDark);
  }
  
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Default to system
    applyTheme('system');
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentSettings = get(settings);
    if (currentSettings.theme === 'system') {
      document.documentElement.classList.toggle('dark', e.matches);
    }
  });
}

// Apply theme when settings change
export function applyTheme(theme: Theme): void {
  localStorage.setItem('notion_time_tracker_theme', theme);
  
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  document.documentElement.classList.toggle('dark', isDark);
}

// Listen for storage changes from service worker
export function setupStorageListener(): () => void {
  return onStorageChange((changes) => {
    if (changes.notion_time_tracker_settings?.newValue) {
      const newSettings = changes.notion_time_tracker_settings.newValue;
      // Ensure filters is always an array
      settings.set({
        ...newSettings,
        filters: Array.isArray(newSettings.filters) ? newSettings.filters : []
      });
    }
    if (changes.notion_time_tracker_timer_state?.newValue) {
      timerState.set(changes.notion_time_tracker_timer_state.newValue);
    }
  });
}

// Send message to service worker
export function sendMessage(message: { type: string; payload?: unknown }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Timer control functions
export async function startTimer(taskId: string, taskTitle: string, previousTotal: number): Promise<void> {
  try {
    await sendMessage({
      type: 'START_TIMER',
      payload: { taskId, taskTitle, previousTotal }
    });
    currentView.set('timer');
  } catch (error) {
    console.error('Failed to start timer:', error);
    errorMessage.set('Failed to start timer');
  }
}

export async function pauseTimer(): Promise<void> {
  try {
    await sendMessage({ type: 'PAUSE_TIMER' });
  } catch (error) {
    console.error('Failed to pause timer:', error);
    errorMessage.set('Failed to pause timer');
  }
}

export async function resumeTimer(): Promise<void> {
  try {
    await sendMessage({ type: 'RESUME_TIMER' });
  } catch (error) {
    console.error('Failed to resume timer:', error);
    errorMessage.set('Failed to resume timer');
  }
}

export async function stopTimer(): Promise<void> {
  try {
    await sendMessage({ type: 'STOP_TIMER' });
    currentView.set('tasks');
  } catch (error) {
    console.error('Failed to stop timer:', error);
    errorMessage.set('Failed to stop timer');
  }
}

export async function getTimerStateFromWorker(): Promise<TimerState> {
  try {
    const response = await sendMessage({ type: 'GET_STATE' }) as { timerState: TimerState };
    return response.timerState;
  } catch (error) {
    console.error('Failed to get timer state:', error);
    return DEFAULT_TIMER_STATE;
  }
}
