<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { formatTimeShort } from '$lib/time';
  import type { NotionTask } from '$lib/types';

  let {
    task,
    isActive = false,
    isPaused = false,
    onplay,
    onclick
  }: {
    task: NotionTask;
    isActive?: boolean;
    isPaused?: boolean;
    onplay?: () => void;
    onclick?: () => void;
  } = $props();

  // For ticking time display when there's an active session
  let currentTime = $state(Date.now());
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Check if this task has an active session in Notion (not from our extension)
  let hasActiveNotionSession = $derived(task.activeSession !== null && !isActive && !isPaused);

  // Calculate display time reactively
  let displayTime = $derived.by(() => {
    if (task.activeSession) {
      const elapsedFromActiveSession = currentTime - task.activeSession.startTime;
      return task.totalTrackedTime + elapsedFromActiveSession;
    }
    return task.totalTrackedTime;
  });

  onMount(() => {
    // If there's an active session, tick up the time
    if (task.activeSession) {
      intervalId = setInterval(() => {
        currentTime = Date.now();
      }, 1000);
    }
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Update interval when activeSession changes
  $effect(() => {
    // Clear existing interval
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    // Set new interval if there's an active session
    if (task.activeSession) {
      currentTime = Date.now();
      intervalId = setInterval(() => {
        currentTime = Date.now();
      }, 1000);
    }
  });

  // Get status color class
  function getStatusColorStyle(color: string): string {
    const colorMap: Record<string, string> = {
      gray: 'var(--color-status-gray)',
      brown: 'var(--color-status-brown)',
      orange: 'var(--color-status-orange)',
      yellow: 'var(--color-status-yellow)',
      green: 'var(--color-status-green)',
      blue: 'var(--color-status-blue)',
      purple: 'var(--color-status-purple)',
      pink: 'var(--color-status-pink)',
      red: 'var(--color-status-red)'
    };
    return colorMap[color] || colorMap.gray;
  }

  function handlePlayClick(e: MouseEvent) {
    e.stopPropagation();
    onplay?.();
  }

  function handleRowClick() {
    onclick?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div 
  class="task-item" 
  class:active={isActive} 
  class:paused={isPaused}
  class:has-active-session={hasActiveNotionSession}
  class:clickable={!!onclick}
  onclick={handleRowClick}
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : -1}
  onkeydown={(e) => e.key === 'Enter' && handleRowClick()}
>
  <button 
    class="play-btn" 
    class:active={isActive}
    class:paused={isPaused}
    class:has-session={hasActiveNotionSession}
    onclick={handlePlayClick}
    aria-label={isActive ? 'Currently tracking' : isPaused ? 'Paused - click to view' : hasActiveNotionSession ? 'End current session and start new' : 'Start tracking'}
  >
    {#if isActive}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="3" width="4" height="10" rx="1" fill="currentColor"/>
        <rect x="9" y="3" width="4" height="10" rx="1" fill="currentColor"/>
      </svg>
    {:else if isPaused}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 3.5V12.5L12.5 8L4 3.5Z" fill="currentColor"/>
      </svg>
    {:else}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 3.5V12.5L12.5 8L4 3.5Z" fill="currentColor"/>
      </svg>
    {/if}
  </button>

  <div class="task-content">
    <span class="task-title" title={task.title}>
      {task.title}
    </span>
    
    <div class="task-meta">
      {#if task.status}
        <span 
          class="status-badge"
          style="background-color: {getStatusColorStyle(task.status.color)}"
        >
          {task.status.name}
        </span>
      {/if}
      
      {#if isPaused}
        <span class="paused-badge">Paused</span>
      {/if}
      
      {#if displayTime > 0 || hasActiveNotionSession}
        <span class="tracked-time" class:ticking={hasActiveNotionSession}>
          {formatTimeShort(displayTime)}
          {#if hasActiveNotionSession}
            <span class="active-indicator" title="Session in progress"></span>
          {/if}
        </span>
      {/if}
    </div>
  </div>

  {#if isPaused || isActive}
    <div class="chevron">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  {/if}
</div>

<style>
  .task-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--color-notion-border);
    transition: background-color 0.15s ease;
  }

  .task-item.clickable {
    cursor: pointer;
  }

  .task-item:hover {
    background-color: var(--color-notion-bg-hover);
  }

  .task-item.active {
    background-color: color-mix(in srgb, var(--color-timer-play) 10%, var(--color-notion-bg));
  }

  .task-item.paused {
    background-color: color-mix(in srgb, var(--color-timer-pause) 10%, var(--color-notion-bg));
  }

  .task-item.has-active-session {
    background-color: color-mix(in srgb, var(--color-timer-play) 8%, var(--color-notion-bg));
  }

  .task-item.has-active-session:hover {
    background-color: color-mix(in srgb, var(--color-timer-play) 12%, var(--color-notion-bg));
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background-color: var(--color-timer-play);
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .play-btn:hover {
    transform: scale(1.05);
    background-color: #27ae60;
  }

  .play-btn.active {
    background-color: var(--color-timer-play);
    animation: pulse-green 2s ease-in-out infinite;
  }

  .play-btn.paused {
    background-color: var(--color-timer-pause);
  }

  .play-btn.paused:hover {
    background-color: #e67e22;
  }

  .play-btn.has-session {
    animation: pulse-green 2s ease-in-out infinite;
  }

  @keyframes pulse-green {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.4);
    }
    50% {
      box-shadow: 0 0 0 6px rgba(46, 204, 113, 0);
    }
  }

  .task-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .task-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-notion-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-notion-text);
  }

  .paused-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    background-color: var(--color-timer-pause);
    color: white;
  }

  .tracked-time {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-notion-text-secondary);
    font-family: var(--font-mono);
  }

  .tracked-time.ticking {
    color: var(--color-timer-play);
    font-weight: 500;
  }

  .active-indicator {
    display: inline-block;
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background-color: var(--color-timer-play);
    animation: blink 1s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .chevron {
    color: var(--color-notion-text-secondary);
    flex-shrink: 0;
  }
</style>
