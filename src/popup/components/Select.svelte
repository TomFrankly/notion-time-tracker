<script lang="ts">
  import { Select as SelectPrimitive } from 'bits-ui';

  interface Option {
    value: string;
    label: string;
  }

  let {
    options = [],
    value = $bindable(''),
    placeholder = 'Select an option',
    disabled = false,
    onchange
  }: {
    options: Option[];
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  } = $props();

  function handleValueChange(newValue: string | undefined) {
    if (newValue !== undefined) {
      value = newValue;
      onchange?.(newValue);
    }
  }

  let selectedLabel = $derived(options.find(o => o.value === value)?.label || '');
</script>

<SelectPrimitive.Root 
  type="single"
  {disabled}
  {value}
  onValueChange={handleValueChange}
>
  <SelectPrimitive.Trigger class="select-trigger" {disabled}>
    <span class="select-value" class:placeholder={!value}>
      {selectedLabel || placeholder}
    </span>
    <svg class="select-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </SelectPrimitive.Trigger>

  <SelectPrimitive.Portal>
    <SelectPrimitive.Content class="select-content" sideOffset={4}>
      <SelectPrimitive.Viewport>
        {#each options as option (option.value)}
          <SelectPrimitive.Item 
            class="select-item" 
            value={option.value}
            label={option.label}
          >
            {#snippet children({ selected })}
              <span class="select-item-text">{option.label}</span>
              {#if selected}
                <svg class="select-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              {/if}
            {/snippet}
          </SelectPrimitive.Item>
        {/each}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
</SelectPrimitive.Root>

<style>
  :global(.select-trigger) {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-notion-border);
    border-radius: 0.375rem;
    background-color: var(--color-notion-bg);
    color: var(--color-notion-text);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  :global(.select-trigger:hover:not(:disabled)) {
    background-color: var(--color-notion-bg-hover);
  }

  :global(.select-trigger:focus) {
    outline: none;
    border-color: var(--color-notion-accent);
  }

  :global(.select-trigger:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .select-value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-value.placeholder {
    color: var(--color-notion-text-secondary);
  }

  .select-icon {
    flex-shrink: 0;
    color: var(--color-notion-text-secondary);
  }

  :global(.select-content) {
    background-color: var(--color-notion-bg);
    border: 1px solid var(--color-notion-border);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    min-width: var(--bits-select-trigger-width);
  }

  :global(.select-item) {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    transition: background-color 0.1s ease;
    font-size: 0.875rem;
    color: var(--color-notion-text);
  }

  :global(.select-item:hover),
  :global(.select-item[data-highlighted]) {
    background-color: var(--color-notion-bg-hover);
  }

  .select-item-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-check {
    flex-shrink: 0;
    color: var(--color-notion-accent);
  }
</style>
