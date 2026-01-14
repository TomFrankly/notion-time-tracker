<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, timerState, startTimer, cachedTasks, updateCachedTasks, currentView, stopTimer, resumeTimer } from '$lib/stores';
  import { queryTasks, getWorkSessions, endActiveSession } from '$lib/notion';
  import { calculateTotalTime } from '$lib/time';
  import TaskItem from '$components/TaskItem.svelte';
  import ConfirmModal from '$components/ConfirmModal.svelte';
  import type { NotionTask } from '$lib/types';

  let tasks = $state<NotionTask[]>([]);
  let isLoading = $state(false);
  let isRefreshing = $state(false);
  let error = $state<string | null>(null);

  // Modal state
  let showSwitchModal = $state(false);
  let pendingTask = $state<NotionTask | null>(null);

  onMount(() => {
    // Load cached tasks immediately
    tasks = $cachedTasks;
    
    // If no cached tasks, fetch fresh ones
    if (tasks.length === 0) {
      loadTasks();
    }
  });

  async function loadTasks() {
    if (!$settings.apiKey || !$settings.tasksDataSourceId) {
      return;
    }

    // Show loading only if we have no cached tasks
    if (tasks.length === 0) {
      isLoading = true;
    }
    isRefreshing = true;
    error = null;

    try {
      // Query tasks from Notion
      const rawTasks = await queryTasks(
        $settings.apiKey,
        $settings.tasksDataSourceId,
        $settings.statusPropertyName,
        $settings.sessionsPropertyName,
        Array.isArray($settings.filters) ? $settings.filters : []
      );

      // Calculate total tracked time for each task
      const tasksWithTime = await Promise.all(
        rawTasks.map(async (task) => {
          if (task.sessionsRelation.length === 0) {
            return { ...task, totalTrackedTime: 0, activeSession: null };
          }

          try {
            const sessions = await getWorkSessions(
              $settings.apiKey,
              task.sessionsRelation,
              $settings.startDatePropertyName,
              $settings.endDatePropertyName
            );
            
            const { completedTime, activeSession } = calculateTotalTime(sessions);
            return { 
              ...task, 
              totalTrackedTime: completedTime,
              activeSession
            };
          } catch {
            return { ...task, totalTrackedTime: 0, activeSession: null };
          }
        })
      );

      tasks = tasksWithTime;
      
      // Cache the tasks
      await updateCachedTasks(tasksWithTime);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      error = 'Failed to load tasks. Please check your settings.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function handlePlayTask(task: NotionTask) {
    // If this task is already paused, just resume it and go to timer view
    if ($timerState.taskId === task.id && $timerState.isPaused) {
      await resumeTimer();
      currentView.set('timer');
      return;
    }

    // Check if there's already a task being tracked (running or paused)
    if ($timerState.taskId && $timerState.taskId !== task.id) {
      // Show confirmation modal
      pendingTask = task;
      showSwitchModal = true;
      return;
    }

    await startTrackingTask(task);
  }

  async function startTrackingTask(task: NotionTask) {
    // If there's an active session in Notion for this task, end it first
    if (task.activeSession) {
      try {
        await endActiveSession(
          $settings.apiKey,
          task.activeSession.id,
          $settings.endDatePropertyName
        );
        // Calculate the time from that session to add to total
        const activeSessionTime = Date.now() - task.activeSession.startTime;
        const newTotalTime = task.totalTrackedTime + activeSessionTime;
        await startTimer(task.id, task.title, newTotalTime);
      } catch (err) {
        console.error('Failed to end active session:', err);
        // Still try to start the timer with what we have
        await startTimer(task.id, task.title, task.totalTrackedTime);
      }
    } else {
      await startTimer(task.id, task.title, task.totalTrackedTime);
    }
  }

  async function handleConfirmSwitch() {
    showSwitchModal = false;
    
    if (!pendingTask) return;

    // Stop the current timer first
    await stopTimer();

    // Then start the new task
    await startTrackingTask(pendingTask);
    pendingTask = null;
  }

  function handleCancelSwitch() {
    showSwitchModal = false;
    pendingTask = null;
  }

  function handleTaskClick(task: NotionTask) {
    // If this task is currently being tracked (running or paused), go to timer view
    if ($timerState.taskId === task.id && ($timerState.isRunning || $timerState.isPaused)) {
      currentView.set('timer');
    }
  }

  // Check if a task is currently being tracked
  function isTaskTracked(taskId: string): boolean {
    return $timerState.taskId === taskId && ($timerState.isRunning || $timerState.isPaused);
  }

  async function handleRefresh() {
    await loadTasks();
  }

  // Get the currently tracked task name for the modal
  let currentTaskName = $derived(
    $timerState.taskTitle || 'current task'
  );
</script>

<div class="task-list">
  {#if isLoading && tasks.length === 0}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading tasks...</p>
    </div>
  {:else if error && tasks.length === 0}
    <div class="error-state">
      <p>{error}</p>
      <button class="btn btn-secondary" onclick={handleRefresh}>
        Try Again
      </button>
    </div>
  {:else if tasks.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>No tasks found</p>
      <span class="empty-hint">
        Check your filters or add tasks to your Notion database
      </span>
      <button class="btn btn-secondary" onclick={handleRefresh}>
        Refresh
      </button>
    </div>
  {:else}
    <div class="task-list-header">
      <span class="task-count">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
      <button 
        class="refresh-btn" 
        class:refreshing={isRefreshing}
        onclick={handleRefresh}
        disabled={isRefreshing}
        aria-label="Refresh tasks"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 8C13.5 11.0376 11.0376 13.5 8 13.5C4.96243 13.5 2.5 11.0376 2.5 8C2.5 4.96243 4.96243 2.5 8 2.5C10.0711 2.5 11.8863 3.60879 12.8284 5.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M10.5 5.5H13V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    {#if error}
      <div class="error-banner">
        <span>{error}</span>
        <button onclick={() => error = null}>×</button>
      </div>
    {/if}

    <div class="tasks">
      {#each tasks as task (task.id)}
        <TaskItem 
          {task}
          isActive={$timerState.taskId === task.id && $timerState.isRunning}
          isPaused={$timerState.taskId === task.id && $timerState.isPaused}
          onplay={() => handlePlayTask(task)}
          onclick={isTaskTracked(task.id) ? () => handleTaskClick(task) : undefined}
        />
      {/each}
    </div>
  {/if}
</div>

<ConfirmModal
  open={showSwitchModal}
  title="Switch Task?"
  message="You're currently tracking '{currentTaskName}'. Would you like to stop that timer and start tracking the new task?"
  confirmText="Switch Task"
  cancelText="Cancel"
  onconfirm={handleConfirmSwitch}
  oncancel={handleCancelSwitch}
/>

<style>
  .task-list {
    display: flex;
    flex-direction: column;
    min-height: 150px;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    gap: 0.75rem;
    text-align: center;
  }

  .loading-state p,
  .error-state p,
  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-notion-text-secondary);
  }

  .error-state p {
    color: #e74c3c;
  }

  .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.25rem;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: var(--color-notion-text-secondary);
  }

  .task-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-notion-border);
    background-color: var(--color-notion-bg-secondary);
  }

  .task-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-notion-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--color-notion-text-secondary);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .refresh-btn:hover:not(:disabled) {
    background-color: var(--color-notion-bg-hover);
    color: var(--color-notion-text);
  }

  .refresh-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .refresh-btn.refreshing svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background-color: var(--color-status-red);
    color: var(--color-notion-text);
    font-size: 0.8125rem;
  }

  .error-banner button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    padding: 0 0.25rem;
  }

  .tasks {
    display: flex;
    flex-direction: column;
  }
</style>
