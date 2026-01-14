<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { formatTime } from '$lib/time';

  let {
    previousTotal = 0,
    sessionStartTime = null,
    isRunning = false
  }: {
    previousTotal?: number;
    sessionStartTime?: number | null;
    isRunning?: boolean;
  } = $props();

  let displayTime = $state('00:00:00');
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function updateDisplay() {
    let total = previousTotal;
    
    if (isRunning && sessionStartTime) {
      const elapsed = Date.now() - sessionStartTime;
      total += elapsed;
    }
    
    displayTime = formatTime(total);
  }

  onMount(() => {
    updateDisplay();
    
    // Update every second when running
    intervalId = setInterval(() => {
      if (isRunning) {
        updateDisplay();
      }
    }, 1000);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Update immediately when props change
  $effect(() => {
    previousTotal;
    sessionStartTime;
    isRunning;
    updateDisplay();
  });
</script>

<div class="timer-display">
  <span class="timer-time">{displayTime}</span>
  {#if isRunning}
    <span class="timer-indicator"></span>
  {/if}
</div>

<style>
  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .timer-time {
    font-family: var(--font-mono);
    font-size: 3rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-notion-text);
    letter-spacing: 0.02em;
  }

  .timer-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background-color: var(--color-timer-play);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
</style>
