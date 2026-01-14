<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    currentView, 
    settings, 
    timerState,
    isLoading,
    isConfigured,
    initializeStores,
    setupStorageListener,
    applyTheme
  } from '$lib/stores';
  import TaskList from './views/TaskList.svelte';
  import Timer from './views/Timer.svelte';
  import Settings from './views/Settings.svelte';
  import type { View } from '$lib/types';

  let unsubscribeStorage: (() => void) | null = null;

  onMount(async () => {
    await initializeStores();
    unsubscribeStorage = setupStorageListener();
    
    // Apply theme from settings
    const unsub = settings.subscribe(s => {
      applyTheme(s.theme);
    });
    
    return () => unsub();
  });

  onDestroy(() => {
    unsubscribeStorage?.();
  });

  function navigateTo(view: View) {
    currentView.set(view);
  }

  // Determine if we should show settings
  $: shouldShowSettings = !$isConfigured && $currentView !== 'settings';
</script>

<div class="app">
  {#if $isLoading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if shouldShowSettings}
    <div class="setup-prompt">
      <div class="setup-icon">⚙️</div>
      <h2>Welcome to Notion Time Tracker</h2>
      <p>Configure your Notion integration to get started.</p>
      <button class="btn btn-primary" onclick={() => navigateTo('settings')}>
        Open Settings
      </button>
    </div>
  {:else}
    <header class="header">
      <div class="header-left">
        {#if $currentView === 'settings'}
          <button 
            class="back-btn" 
            onclick={() => navigateTo($timerState.taskId ? 'timer' : 'tasks')}
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {:else if $currentView === 'timer'}
          <button 
            class="back-btn" 
            onclick={() => navigateTo('tasks')}
            aria-label="Back to tasks"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {/if}
        <h1 class="header-title">
          {#if $currentView === 'settings'}
            Settings
          {:else if $currentView === 'timer'}
            Timer
          {:else}
            Tasks
          {/if}
        </h1>
      </div>
      
      {#if $currentView !== 'settings'}
        <button 
          class="settings-btn" 
          onclick={() => navigateTo('settings')}
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M16.1667 10C16.1667 9.58333 16.125 9.16667 16.0417 8.79167L17.5833 7.58333L16.0833 4.91667L14.2917 5.58333C13.7083 5.08333 13.0417 4.70833 12.3333 4.45833L12.0833 2.5H9.08333L8.83333 4.45833C8.125 4.70833 7.45833 5.08333 6.875 5.58333L5.08333 4.91667L3.58333 7.58333L5.125 8.79167C5.04167 9.16667 5 9.58333 5 10C5 10.4167 5.04167 10.8333 5.125 11.2083L3.58333 12.4167L5.08333 15.0833L6.875 14.4167C7.45833 14.9167 8.125 15.2917 8.83333 15.5417L9.08333 17.5H12.0833L12.3333 15.5417C13.0417 15.2917 13.7083 14.9167 14.2917 14.4167L16.0833 15.0833L17.5833 12.4167L16.0417 11.2083C16.125 10.8333 16.1667 10.4167 16.1667 10Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      {/if}
    </header>

    <main class="main">
      {#if $currentView === 'tasks'}
        <TaskList />
      {:else if $currentView === 'timer'}
        <Timer />
      {:else if $currentView === 'settings'}
        <Settings />
      {/if}
    </main>
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 200px;
    max-height: 500px;
    background-color: var(--color-notion-bg);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    gap: 1rem;
    color: var(--color-notion-text-secondary);
  }

  .setup-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    text-align: center;
    gap: 0.75rem;
  }

  .setup-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .setup-prompt h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-notion-text);
  }

  .setup-prompt p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-notion-text-secondary);
  }

  .setup-prompt .btn {
    margin-top: 0.5rem;
    padding: 0.5rem 1.25rem;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-notion-border);
    background-color: var(--color-notion-bg);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-notion-text);
  }

  .back-btn,
  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-notion-text-secondary);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .back-btn:hover,
  .settings-btn:hover {
    background-color: var(--color-notion-bg-hover);
    color: var(--color-notion-text);
  }

  .main {
    flex: 1;
    overflow-y: auto;
  }
</style>
