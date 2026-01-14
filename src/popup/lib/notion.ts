import type { 
  NotionDatabase, 
  NotionProperty, 
  NotionTask, 
  NotionWorkSession,
  TaskFilter,
  NotionStatusOption
} from './types';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Make an authenticated request to Notion API
 */
async function notionRequest<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Notion API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Validate API key by fetching current user
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await notionRequest(apiKey, '/users/me');
    return true;
  } catch {
    return false;
  }
}

/**
 * Search for databases by title
 */
export async function searchDatabases(
  apiKey: string,
  query: string = ''
): Promise<NotionDatabase[]> {
  interface SearchResult {
    results: Array<{
      id: string;
      object: string;
      title?: Array<{ plain_text: string }>;
      properties: Record<string, NotionProperty>;
    }>;
  }

  const response = await notionRequest<SearchResult>(apiKey, '/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      filter: {
        property: 'object',
        value: 'database'
      },
      page_size: 100
    })
  });

  return response.results
    .filter(item => item.object === 'database')
    .map(db => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled',
      properties: db.properties
    }));
}

/**
 * Get database by ID
 */
export async function getDatabase(
  apiKey: string,
  databaseId: string
): Promise<NotionDatabase> {
  interface DatabaseResponse {
    id: string;
    title: Array<{ plain_text: string }>;
    properties: Record<string, NotionProperty>;
  }

  const response = await notionRequest<DatabaseResponse>(
    apiKey,
    `/databases/${databaseId}`
  );

  return {
    id: response.id,
    title: response.title?.[0]?.plain_text || 'Untitled',
    properties: response.properties
  };
}

/**
 * Get properties of a specific type from a database
 */
export function getPropertiesByType(
  properties: Record<string, NotionProperty>,
  type: string
): NotionProperty[] {
  return Object.values(properties).filter(prop => prop.type === type);
}

/**
 * Get the title property from a database
 */
export function getTitleProperty(
  properties: Record<string, NotionProperty>
): NotionProperty | undefined {
  return Object.values(properties).find(prop => prop.type === 'title');
}

/**
 * Get status options from a status property
 */
export function getStatusOptions(property: NotionProperty): NotionStatusOption[] {
  if (property.type !== 'status' || !property.status) {
    return [];
  }
  return property.status.options;
}

/**
 * Build Notion filter from task filters
 */
function buildNotionFilter(filters: TaskFilter[]): object | undefined {
  // Defensive check - ensure filters is an array
  if (!Array.isArray(filters) || filters.length === 0) return undefined;

  const conditions = filters.map(filter => {
    if (filter.propertyType === 'status') {
      return {
        property: filter.propertyName,
        status: { equals: filter.value as string }
      };
    } else if (filter.propertyType === 'checkbox') {
      return {
        property: filter.propertyName,
        checkbox: { equals: filter.value as boolean }
      };
    }
    return null;
  }).filter(Boolean);

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0] as object;
  
  return { and: conditions };
}

/**
 * Query tasks from database with filters
 */
export async function queryTasks(
  apiKey: string,
  databaseId: string,
  statusPropertyName: string,
  sessionsPropertyName: string,
  filters: TaskFilter[] = []
): Promise<NotionTask[]> {
  interface QueryResult {
    results: Array<{
      id: string;
      properties: Record<string, unknown>;
      last_edited_time: string;
    }>;
  }

  const filter = buildNotionFilter(filters);
  
  const response = await notionRequest<QueryResult>(apiKey, `/databases/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter,
      sorts: [
        {
          timestamp: 'last_edited_time',
          direction: 'descending'
        }
      ],
      page_size: 100
    })
  });

  return response.results.map(page => {
    // Get title
    const titleProp = Object.values(page.properties).find(
      (p: unknown) => (p as { type: string }).type === 'title'
    ) as { title: Array<{ plain_text: string }> } | undefined;
    
    const title = titleProp?.title?.[0]?.plain_text || 'Untitled';

    // Get status
    const statusProp = page.properties[statusPropertyName] as {
      status: { name: string; color: string } | null;
    } | undefined;
    
    const status = statusProp?.status || null;

    // Get sessions relation IDs
    const sessionsProp = page.properties[sessionsPropertyName] as {
      relation: Array<{ id: string }>;
    } | undefined;
    
    const sessionsRelation = sessionsProp?.relation?.map(r => r.id) || [];

    return {
      id: page.id,
      title,
      status,
      sessionsRelation,
      totalTrackedTime: 0, // Will be calculated separately
      lastEditedTime: page.last_edited_time
    };
  });
}

/**
 * Work session with active status
 */
export interface WorkSessionWithStatus extends NotionWorkSession {
  isActive: boolean;
}

/**
 * Get work sessions for calculating total time
 */
export async function getWorkSessions(
  apiKey: string,
  sessionIds: string[],
  startDatePropertyName: string,
  endDatePropertyName: string
): Promise<WorkSessionWithStatus[]> {
  if (sessionIds.length === 0) return [];

  interface PageResponse {
    id: string;
    properties: Record<string, unknown>;
  }

  const sessions = await Promise.all(
    sessionIds.map(async (id) => {
      try {
        const page = await notionRequest<PageResponse>(apiKey, `/pages/${id}`);
        
        const startProp = page.properties[startDatePropertyName] as {
          date: { start: string } | null;
        } | undefined;
        
        const endProp = page.properties[endDatePropertyName] as {
          date: { start: string } | null;
        } | undefined;

        // Get task relation to find taskId
        const relationProp = Object.values(page.properties).find(
          (p: unknown) => (p as { type: string }).type === 'relation'
        ) as { relation: Array<{ id: string }> } | undefined;

        const hasStart = !!startProp?.date?.start;
        const hasEnd = !!endProp?.date?.start;

        return {
          id: page.id,
          taskId: relationProp?.relation?.[0]?.id || '',
          startDate: startProp?.date?.start || null,
          endDate: endProp?.date?.start || null,
          isActive: hasStart && !hasEnd // Active if has start but no end
        };
      } catch {
        return null;
      }
    })
  );

  return sessions.filter((s): s is WorkSessionWithStatus => s !== null);
}

/**
 * End an active work session
 */
export async function endActiveSession(
  apiKey: string,
  sessionId: string,
  endDatePropertyName: string
): Promise<void> {
  await notionRequest(apiKey, `/pages/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        [endDatePropertyName]: {
          date: { start: new Date().toISOString() }
        }
      }
    })
  });
}

/**
 * Create a new work session
 */
export async function createWorkSession(
  apiKey: string,
  workSessionsDbId: string,
  taskId: string,
  taskRelationPropertyName: string,
  startDatePropertyName: string,
  startDate: string
): Promise<string> {
  interface CreateResponse {
    id: string;
  }

  const response = await notionRequest<CreateResponse>(apiKey, '/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: workSessionsDbId },
      properties: {
        [taskRelationPropertyName]: {
          relation: [{ id: taskId }]
        },
        [startDatePropertyName]: {
          date: { start: startDate }
        }
      }
    })
  });

  return response.id;
}

/**
 * Update work session with end date
 */
export async function updateWorkSessionEndDate(
  apiKey: string,
  sessionId: string,
  endDatePropertyName: string,
  endDate: string
): Promise<void> {
  await notionRequest(apiKey, `/pages/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        [endDatePropertyName]: {
          date: { start: endDate }
        }
      }
    })
  });
}

/**
 * Find the task relation property name in work sessions database
 */
export async function findTaskRelationProperty(
  apiKey: string,
  workSessionsDbId: string,
  tasksDbId: string
): Promise<string | null> {
  const db = await getDatabase(apiKey, workSessionsDbId);
  
  const relationProps = getPropertiesByType(db.properties, 'relation');
  const taskRelation = relationProps.find(
    prop => prop.relation?.database_id === tasksDbId
  );
  
  return taskRelation?.name || null;
}

/**
 * Get checkbox properties from a database
 */
export function getCheckboxProperties(
  properties: Record<string, NotionProperty>
): NotionProperty[] {
  return getPropertiesByType(properties, 'checkbox');
}

/**
 * Get date properties from a database
 */
export function getDateProperties(
  properties: Record<string, NotionProperty>
): NotionProperty[] {
  return getPropertiesByType(properties, 'date');
}

/**
 * Find property by name (case-insensitive)
 */
export function findPropertyByName(
  properties: Record<string, NotionProperty>,
  name: string,
  type?: string
): NotionProperty | undefined {
  const lowerName = name.toLowerCase();
  return Object.values(properties).find(
    prop => prop.name.toLowerCase() === lowerName && (!type || prop.type === type)
  );
}
