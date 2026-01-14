<script lang="ts">
  import Select from './Select.svelte';
  import type { TaskFilter, NotionProperty, NotionStatusOption } from '$lib/types';

  let {
    filters = $bindable([]),
    statusProperties = [],
    checkboxProperties = [],
    onchange
  }: {
    filters?: TaskFilter[];
    statusProperties: NotionProperty[];
    checkboxProperties: NotionProperty[];
    onchange?: (filters: TaskFilter[]) => void;
  } = $props();

  // Ensure filters is always an array
  let safeFilters = $derived(Array.isArray(filters) ? filters : []);

  // Get available properties for filter selection
  let availableProperties = $derived([
    ...(Array.isArray(statusProperties) ? statusProperties : []).map(p => ({ 
      value: `status:${p.id}`, 
      label: `${p.name} (Status)`,
      property: p,
      type: 'status' as const
    })),
    ...(Array.isArray(checkboxProperties) ? checkboxProperties : []).map(p => ({ 
      value: `checkbox:${p.id}`, 
      label: `${p.name} (Checkbox)`,
      property: p,
      type: 'checkbox' as const
    }))
  ]);

  function addFilter() {
    const id = crypto.randomUUID();
    const currentFilters = Array.isArray(filters) ? filters : [];
    filters = [...currentFilters, {
      id,
      propertyId: '',
      propertyName: '',
      propertyType: 'status',
      value: ''
    }];
    onchange?.(filters);
  }

  function removeFilter(id: string) {
    const currentFilters = Array.isArray(filters) ? filters : [];
    filters = currentFilters.filter(f => f.id !== id);
    onchange?.(filters);
  }

  function updateFilterProperty(filterId: string, selection: string) {
    const [type, propId] = selection.split(':');
    const prop = availableProperties.find(p => p.value === selection);
    
    if (!prop) return;

    const currentFilters = Array.isArray(filters) ? filters : [];
    filters = currentFilters.map(f => {
      if (f.id === filterId) {
        return {
          ...f,
          propertyId: propId,
          propertyName: prop.property.name,
          propertyType: type as 'status' | 'checkbox',
          value: type === 'checkbox' ? false : ''
        };
      }
      return f;
    });
    onchange?.(filters);
  }

  function updateFilterValue(filterId: string, value: string | boolean) {
    const currentFilters = Array.isArray(filters) ? filters : [];
    filters = currentFilters.map(f => {
      if (f.id === filterId) {
        return { ...f, value };
      }
      return f;
    });
    onchange?.(filters);
  }

  function getStatusOptions(filter: TaskFilter): NotionStatusOption[] {
    const props = Array.isArray(statusProperties) ? statusProperties : [];
    const prop = props.find(p => p.id === filter.propertyId);
    return prop?.status?.options || [];
  }
</script>

<div class="filter-builder">
  <div class="filter-header">
    <span class="filter-label">Task Filters</span>
    <button 
      type="button" 
      class="add-filter-btn"
      onclick={addFilter}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Add Filter
    </button>
  </div>

  {#if safeFilters.length === 0}
    <p class="no-filters">No filters applied. All tasks will be shown.</p>
  {:else}
    <div class="filters-list">
      {#each safeFilters as filter (filter.id)}
        <div class="filter-row">
          <div class="filter-property">
            <Select
              options={availableProperties.map(p => ({ value: p.value, label: p.label }))}
              value={filter.propertyId ? `${filter.propertyType}:${filter.propertyId}` : ''}
              placeholder="Select property"
              onchange={(v) => updateFilterProperty(filter.id, v)}
            />
          </div>

          {#if filter.propertyId}
            <div class="filter-value">
              {#if filter.propertyType === 'status'}
                <Select
                  options={getStatusOptions(filter).map(o => ({ value: o.name, label: o.name }))}
                  value={filter.value as string}
                  placeholder="Select status"
                  onchange={(v) => updateFilterValue(filter.id, v)}
                />
              {:else if filter.propertyType === 'checkbox'}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filter.value as boolean}
                    onchange={(e) => updateFilterValue(filter.id, e.currentTarget.checked)}
                  />
                  <span>{filter.value ? 'Checked' : 'Unchecked'}</span>
                </label>
              {/if}
            </div>
          {/if}

          <button
            type="button"
            class="remove-filter-btn"
            onclick={() => removeFilter(filter.id)}
            aria-label="Remove filter"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .filter-builder {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .filter-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-notion-text-secondary);
  }

  .add-filter-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 0.25rem;
    background-color: transparent;
    color: var(--color-notion-accent);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .add-filter-btn:hover {
    background-color: var(--color-notion-bg-hover);
  }

  .no-filters {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-notion-text-secondary);
    background-color: var(--color-notion-bg-secondary);
    border-radius: 0.375rem;
    text-align: center;
  }

  .filters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-property {
    flex: 1;
    min-width: 0;
  }

  .filter-value {
    flex: 1;
    min-width: 0;
  }

  .remove-filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 0.25rem;
    background-color: transparent;
    color: var(--color-notion-text-secondary);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    flex-shrink: 0;
  }

  .remove-filter-btn:hover {
    background-color: var(--color-status-red);
    color: var(--color-notion-text);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-notion-border);
    border-radius: 0.375rem;
    background-color: var(--color-notion-bg);
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-notion-text);
  }

  .checkbox-label input {
    width: 1rem;
    height: 1rem;
    accent-color: var(--color-notion-accent);
  }
</style>
