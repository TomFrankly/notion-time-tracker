<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, updateSettingsStore, applyTheme } from '$lib/stores';
  import { 
    validateApiKey, 
    searchDatabases, 
    getDatabase,
    getPropertiesByType,
    findPropertyByName,
    getStatusOptions
  } from '$lib/notion';
  import Select from '$components/Select.svelte';
  import FilterBuilder from '$components/FilterBuilder.svelte';
  import type { 
    NotionDatabase, 
    NotionProperty, 
    Theme,
    TaskFilter
  } from '$lib/types';

  // Local state
  let apiKey = $state($settings.apiKey);
  let isValidatingKey = $state(false);
  let keyValidationError = $state<string | null>(null);
  let isKeyValid = $state(!!$settings.apiKey);

  let databases = $state<NotionDatabase[]>([]);
  let isLoadingDatabases = $state(false);
  
  let selectedTasksDb = $state<NotionDatabase | null>(null);
  let isLoadingTasksDb = $state(false);
  
  let workSessionsDb = $state<NotionDatabase | null>(null);
  let isLoadingWorkSessionsDb = $state(false);

  // Property options
  let statusProperties = $state<NotionProperty[]>([]);
  let relationProperties = $state<NotionProperty[]>([]);
  let dateProperties = $state<NotionProperty[]>([]);
  let checkboxProperties = $state<NotionProperty[]>([]);

  // Selected values - initialized from settings
  let selectedTasksDbId = $state('');
  let selectedStatusPropId = $state('');
  let selectedSessionsPropId = $state('');
  let selectedStartDatePropId = $state('');
  let selectedEndDatePropId = $state('');
  let selectedTheme = $state<Theme>('system');
  let filters = $state<TaskFilter[]>([]);

  onMount(async () => {
    // Initialize local state from saved settings
    apiKey = $settings.apiKey || '';
    selectedTasksDbId = $settings.tasksDataSourceId || '';
    selectedStatusPropId = $settings.statusPropertyId || '';
    selectedSessionsPropId = $settings.sessionsPropertyId || '';
    selectedStartDatePropId = $settings.startDatePropertyId || '';
    selectedEndDatePropId = $settings.endDatePropertyId || '';
    selectedTheme = $settings.theme || 'system';
    filters = Array.isArray($settings.filters) ? [...$settings.filters] : [];
    isKeyValid = !!$settings.apiKey;

    console.log('Settings loaded:', {
      apiKey: !!apiKey,
      tasksDbId: selectedTasksDbId,
      filters: filters.length
    });

    if ($settings.apiKey) {
      await loadDatabases();
      if ($settings.tasksDataSourceId) {
        // Pass true to indicate this is initial load - don't overwrite saved settings
        await loadTasksDatabase($settings.tasksDataSourceId, true);
      }
    }
  });

  async function handleApiKeySubmit() {
    if (!apiKey.trim()) {
      keyValidationError = 'Please enter an API key';
      return;
    }

    isValidatingKey = true;
    keyValidationError = null;

    try {
      const isValid = await validateApiKey(apiKey.trim());
      if (isValid) {
        isKeyValid = true;
        await updateSettingsStore({ apiKey: apiKey.trim() });
        await loadDatabases();
      } else {
        keyValidationError = 'Invalid API key. Please check and try again.';
        isKeyValid = false;
      }
    } catch (error) {
      keyValidationError = 'Failed to validate API key. Please try again.';
      isKeyValid = false;
    } finally {
      isValidatingKey = false;
    }
  }

  async function loadDatabases() {
    if (!$settings.apiKey) return;
    
    isLoadingDatabases = true;
    try {
      databases = await searchDatabases($settings.apiKey);
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      isLoadingDatabases = false;
    }
  }

  async function handleTasksDbChange(dbId: string) {
    selectedTasksDbId = dbId;
    selectedStatusPropId = '';
    selectedSessionsPropId = '';
    selectedStartDatePropId = '';
    selectedEndDatePropId = '';
    workSessionsDb = null;
    dateProperties = [];
    filters = []; // Clear filters when changing database
    
    if (dbId) {
      // Pass false to indicate user is changing selection
      await loadTasksDatabase(dbId, false);
    } else {
      selectedTasksDb = null;
      statusProperties = [];
      relationProperties = [];
      checkboxProperties = [];
    }
    
    // Save cleared filters
    await updateSettingsStore({ filters: [] });
  }

  async function loadTasksDatabase(dbId: string, isInitialLoad: boolean = false) {
    if (!$settings.apiKey) return;
    
    isLoadingTasksDb = true;
    try {
      selectedTasksDb = await getDatabase($settings.apiKey, dbId);
      
      // Get property options
      statusProperties = getPropertiesByType(selectedTasksDb.properties, 'status');
      relationProperties = getPropertiesByType(selectedTasksDb.properties, 'relation');
      checkboxProperties = getPropertiesByType(selectedTasksDb.properties, 'checkbox');

      // Only set defaults if this is not an initial load (user is changing selection)
      // or if no values are already set
      if (!isInitialLoad) {
        // Try to find defaults only when user changes database
        const defaultStatus = findPropertyByName(selectedTasksDb.properties, 'Status', 'status');
        const defaultSessions = findPropertyByName(selectedTasksDb.properties, 'Sessions', 'relation') ||
                               findPropertyByName(selectedTasksDb.properties, 'Work Sessions', 'relation');

        if (defaultStatus && !selectedStatusPropId) {
          selectedStatusPropId = defaultStatus.id;
        }
        if (defaultSessions && !selectedSessionsPropId) {
          selectedSessionsPropId = defaultSessions.id;
          await handleSessionsPropertyChange(defaultSessions.id);
        }

        // Save to settings only when user changes database
        const dbName = selectedTasksDb.title;
        const statusProp = statusProperties.find(p => p.id === selectedStatusPropId);
        
        await updateSettingsStore({
          tasksDataSourceId: dbId,
          tasksDataSourceName: dbName,
          statusPropertyId: selectedStatusPropId,
          statusPropertyName: statusProp?.name || ''
        });
      } else {
        // On initial load, just load the sessions database if we have a sessions property
        if (selectedSessionsPropId) {
          const sessionsProp = relationProperties.find(p => p.id === selectedSessionsPropId);
          if (sessionsProp?.relation?.database_id) {
            await loadWorkSessionsDatabase(sessionsProp.relation.database_id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load tasks database:', error);
    } finally {
      isLoadingTasksDb = false;
    }
  }

  async function handleStatusPropertyChange(propId: string) {
    selectedStatusPropId = propId;
    const prop = statusProperties.find(p => p.id === propId);
    await updateSettingsStore({
      statusPropertyId: propId,
      statusPropertyName: prop?.name || ''
    });
  }

  async function handleSessionsPropertyChange(propId: string) {
    selectedSessionsPropId = propId;
    selectedStartDatePropId = '';
    selectedEndDatePropId = '';
    
    const prop = relationProperties.find(p => p.id === propId);
    await updateSettingsStore({
      sessionsPropertyId: propId,
      sessionsPropertyName: prop?.name || ''
    });

    // Load the related database
    if (prop?.relation?.database_id) {
      await loadWorkSessionsDatabase(prop.relation.database_id);
    } else {
      workSessionsDb = null;
      dateProperties = [];
    }
  }

  async function loadWorkSessionsDatabase(dbId: string) {
    if (!$settings.apiKey) return;
    
    isLoadingWorkSessionsDb = true;
    try {
      workSessionsDb = await getDatabase($settings.apiKey, dbId);
      dateProperties = getPropertiesByType(workSessionsDb.properties, 'date');

      // Check if we have at least 2 date properties
      if (dateProperties.length < 2) {
        console.warn('Work sessions database needs at least 2 date properties');
      }

      // Try to find defaults
      const defaultStart = findPropertyByName(workSessionsDb.properties, 'Start', 'date');
      const defaultEnd = findPropertyByName(workSessionsDb.properties, 'End', 'date');

      if (defaultStart && !selectedStartDatePropId) {
        selectedStartDatePropId = defaultStart.id;
      }
      if (defaultEnd && !selectedEndDatePropId) {
        selectedEndDatePropId = defaultEnd.id;
      }

      // Save to settings
      const startProp = dateProperties.find(p => p.id === selectedStartDatePropId);
      const endProp = dateProperties.find(p => p.id === selectedEndDatePropId);
      
      await updateSettingsStore({
        workSessionsDataSourceId: dbId,
        workSessionsDataSourceName: workSessionsDb.title,
        startDatePropertyId: selectedStartDatePropId,
        startDatePropertyName: startProp?.name || '',
        endDatePropertyId: selectedEndDatePropId,
        endDatePropertyName: endProp?.name || ''
      });
    } catch (error) {
      console.error('Failed to load work sessions database:', error);
    } finally {
      isLoadingWorkSessionsDb = false;
    }
  }

  async function handleStartDateChange(propId: string) {
    selectedStartDatePropId = propId;
    const prop = dateProperties.find(p => p.id === propId);
    await updateSettingsStore({
      startDatePropertyId: propId,
      startDatePropertyName: prop?.name || ''
    });
  }

  async function handleEndDateChange(propId: string) {
    selectedEndDatePropId = propId;
    const prop = dateProperties.find(p => p.id === propId);
    await updateSettingsStore({
      endDatePropertyId: propId,
      endDatePropertyName: prop?.name || ''
    });
  }

  async function handleThemeChange(theme: Theme) {
    selectedTheme = theme;
    applyTheme(theme);
    await updateSettingsStore({ theme });
  }

  async function handleFiltersChange(newFilters: TaskFilter[]) {
    console.log('Saving filters:', newFilters);
    filters = [...newFilters];
    await updateSettingsStore({ filters: newFilters });
  }

  // Database options for select
  let databaseOptions = $derived(databases.map(db => ({
    value: db.id,
    label: db.title
  })));

  let statusPropertyOptions = $derived(statusProperties.map(p => ({
    value: p.id,
    label: p.name
  })));

  let relationPropertyOptions = $derived(relationProperties.map(p => ({
    value: p.id,
    label: p.name
  })));

  let datePropertyOptions = $derived(dateProperties.map(p => ({
    value: p.id,
    label: p.name
  })));

  const themeOptions = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];
</script>

<div class="settings">
  <!-- API Key Section -->
  <section class="settings-section">
    <h2 class="section-title">Notion Integration</h2>
    <p class="section-description">
      Enter your Notion Internal Integration token. 
      <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener">
        Create one here
      </a>
    </p>
    
    <div class="api-key-form">
      <input
        type="password"
        class="input"
        placeholder="secret_xxxxx..."
        bind:value={apiKey}
        disabled={isValidatingKey}
      />
      <button 
        class="btn btn-primary"
        onclick={handleApiKeySubmit}
        disabled={isValidatingKey}
      >
        {#if isValidatingKey}
          <span class="spinner"></span>
        {:else}
          {isKeyValid ? 'Update' : 'Connect'}
        {/if}
      </button>
    </div>
    
    {#if keyValidationError}
      <p class="error-message">{keyValidationError}</p>
    {/if}
    
    {#if isKeyValid}
      <p class="success-message">✓ Connected to Notion</p>
    {/if}
  </section>

  {#if isKeyValid}
    <!-- Tasks Database Section -->
    <section class="settings-section">
      <h2 class="section-title">Tasks Database</h2>
      <p class="section-description">Select your tasks database from Notion.</p>
      
      <div class="form-field">
        <label class="field-label">Tasks Database</label>
        {#if isLoadingDatabases}
          <div class="loading-field">
            <span class="spinner"></span>
            Loading databases...
          </div>
        {:else}
          <Select
            options={databaseOptions}
            value={selectedTasksDbId}
            placeholder="Select a database"
            onchange={handleTasksDbChange}
          />
        {/if}
      </div>

      {#if selectedTasksDb}
        <div class="form-field">
          <label class="field-label">Task Status Property</label>
          {#if isLoadingTasksDb}
            <div class="loading-field">
              <span class="spinner"></span>
              Loading...
            </div>
          {:else}
            <Select
              options={statusPropertyOptions}
              value={selectedStatusPropId}
              placeholder="Select status property"
              onchange={handleStatusPropertyChange}
            />
          {/if}
        </div>

        <div class="form-field">
          <label class="field-label">Sessions Relation Property</label>
          {#if isLoadingTasksDb}
            <div class="loading-field">
              <span class="spinner"></span>
              Loading...
            </div>
          {:else}
            <Select
              options={relationPropertyOptions}
              value={selectedSessionsPropId}
              placeholder="Select sessions property"
              onchange={handleSessionsPropertyChange}
            />
          {/if}
        </div>
      {/if}
    </section>

    {#if workSessionsDb}
      <!-- Work Sessions Database Section -->
      <section class="settings-section">
        <h2 class="section-title">Work Sessions Database</h2>
        <p class="section-description">
          Configure the "{workSessionsDb.title}" database for time tracking entries.
        </p>

        {#if dateProperties.length < 2}
          <p class="warning-message">
            This database needs at least 2 date properties for Start and End times.
          </p>
        {:else}
          <div class="form-field">
            <label class="field-label">Start Date Property</label>
            {#if isLoadingWorkSessionsDb}
              <div class="loading-field">
                <span class="spinner"></span>
                Loading...
              </div>
            {:else}
              <Select
                options={datePropertyOptions}
                value={selectedStartDatePropId}
                placeholder="Select start date property"
                onchange={handleStartDateChange}
              />
            {/if}
          </div>

          <div class="form-field">
            <label class="field-label">End Date Property</label>
            {#if isLoadingWorkSessionsDb}
              <div class="loading-field">
                <span class="spinner"></span>
                Loading...
              </div>
            {:else}
              <Select
                options={datePropertyOptions}
                value={selectedEndDatePropId}
                placeholder="Select end date property"
                onchange={handleEndDateChange}
              />
            {/if}
          </div>
        {/if}
      </section>
    {/if}

    {#if selectedTasksDb && statusProperties.length > 0}
      <!-- Task Filters Section -->
      <section class="settings-section">
        <h2 class="section-title">Task Filters</h2>
        <p class="section-description">Filter which tasks appear in the list.</p>
        
        <FilterBuilder
          {filters}
          {statusProperties}
          {checkboxProperties}
          onchange={handleFiltersChange}
        />
      </section>
    {/if}
  {/if}

  <!-- Theme Section -->
  <section class="settings-section">
    <h2 class="section-title">Appearance</h2>
    
    <div class="form-field">
      <label class="field-label">Theme</label>
      <Select
        options={themeOptions}
        value={selectedTheme}
        onchange={(v) => handleThemeChange(v as Theme)}
      />
    </div>
  </section>

  <!-- Version Info -->
  <footer class="settings-footer">
    <p>Notion Time Tracker v1.0.0</p>
  </footer>
</div>

<style>
  .settings {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-notion-text);
  }

  .section-description {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-notion-text-secondary);
    line-height: 1.4;
  }

  .section-description a {
    color: var(--color-notion-accent);
    text-decoration: none;
  }

  .section-description a:hover {
    text-decoration: underline;
  }

  .api-key-form {
    display: flex;
    gap: 0.5rem;
  }

  .api-key-form .input {
    flex: 1;
  }

  .api-key-form .btn {
    padding: 0.5rem 1rem;
    white-space: nowrap;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-notion-text-secondary);
  }

  .loading-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: var(--color-notion-text-secondary);
    border: 1px solid var(--color-notion-border);
    border-radius: 0.375rem;
    background-color: var(--color-notion-bg-secondary);
  }

  .error-message {
    margin: 0;
    font-size: 0.8125rem;
    color: #e74c3c;
  }

  .success-message {
    margin: 0;
    font-size: 0.8125rem;
    color: #2ecc71;
  }

  .warning-message {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-notion-text);
    background-color: var(--color-status-yellow);
    border-radius: 0.375rem;
  }

  .settings-footer {
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-notion-border);
    text-align: center;
  }

  .settings-footer p {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-notion-text-secondary);
  }
</style>
