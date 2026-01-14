<script lang="ts">
  import { timerState, pauseTimer, resumeTimer, stopTimer } from '$lib/stores';
  import TimerDisplay from '$components/TimerDisplay.svelte';

  let isProcessing = $state(false);

  async function handlePause() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await pauseTimer();
    } finally {
      isProcessing = false;
    }
  }

  async function handleResume() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await resumeTimer();
    } finally {
      isProcessing = false;
    }
  }

  async function handleStop() {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await stopTimer();
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="timer-view">
  {#if $timerState.taskId}
    <div class="task-info">
      <h2 class="task-title" title={$timerState.taskTitle}>
        {$timerState.taskTitle}
      </h2>
      <span class="task-status">
        {$timerState.isRunning ? 'Tracking' : 'Paused'}
      </span>
    </div>

    <div class="timer-container">
      <TimerDisplay 
        previousTotal={$timerState.previousTotal}
        sessionStartTime={$timerState.sessionStartTime}
        isRunning={$timerState.isRunning}
      />
    </div>

    <div class="timer-controls">
      {#if $timerState.isRunning}
        <button 
          class="control-btn pause"
          onclick={handlePause}
          disabled={isProcessing}
          aria-label="Pause timer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
          </svg>
        </button>
      {:else}
        <button 
          class="control-btn play"
          onclick={handleResume}
          disabled={isProcessing}
          aria-label="Resume timer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M7 5.5V18.5L19 12L7 5.5Z" fill="currentColor"/>
          </svg>
        </button>
      {/if}

      <button 
        class="control-btn stop"
        onclick={handleStop}
        disabled={isProcessing}
        aria-label="Stop timer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
        </svg>
      </button>
    </div>

    {#if isProcessing}
      <div class="processing-indicator">
        <span class="spinner"></span>
        <span>Saving to Notion...</span>
      </div>
    {/if}
  {:else}
    <div class="no-task">
      <p>No task selected</p>
    </div>
  {/if}
</div>

<style>
  .timer-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1rem;
    gap: 1.5rem;
    min-height: 300px;
  }

  .task-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    text-align: center;
    max-width: 100%;
    padding: 0 1rem;
  }

  .task-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-notion-text);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-status {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-notion-text-secondary);
  }

  .timer-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0;
  }

  .timer-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    color: white;
  }

  .control-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .control-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .control-btn.play {
    background-color: var(--color-timer-play);
  }

  .control-btn.play:hover:not(:disabled) {
    background-color: #27ae60;
  }

  .control-btn.pause {
    background-color: var(--color-timer-pause);
  }

  .control-btn.pause:hover:not(:disabled) {
    background-color: #e67e22;
  }

  .control-btn.stop {
    background-color: var(--color-timer-stop);
  }

  .control-btn.stop:hover:not(:disabled) {
    background-color: #c0392b;
  }

  .processing-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    color: var(--color-notion-text-secondary);
    background-color: var(--color-notion-bg-secondary);
    border-radius: 9999px;
  }

  .no-task {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }

  .no-task p {
    margin: 0;
    color: var(--color-notion-text-secondary);
  }
</style>
