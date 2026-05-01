import type { EventStatus, EventSummary } from './types';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function capitalizeWord(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatEventDateTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatEventStatus(value: EventStatus) {
  return value
    .split('_')
    .map(capitalizeWord)
    .join(' ');
}

export function formatDateTimeInput(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateTimeInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.replace(/\s+/, 'T');
  const date = new Date(normalized);

  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

export function tagsToInput(tags: string[]) {
  return tags.join(', ');
}

export function tagsFromInput(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function capitalizeLocation(value: string) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function filterEventsByQuery(
  events: EventSummary[],
  query: string,
  categoryNameById?: ReadonlyMap<string, string>,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return events;
  }

  return events.filter((event) => {
    const categoryName = categoryNameById?.get(event.categoryId)?.toLowerCase() ?? '';

    return (
      event.title.toLowerCase().includes(normalizedQuery) ||
      event.location.toLowerCase().includes(normalizedQuery) ||
      categoryName.includes(normalizedQuery)
    );
  });
}
