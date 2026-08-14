import { AutoReloadErrorMatcher } from './auto-reload-options';

const CHUNK_ERROR_PATTERNS: readonly RegExp[] = [
  /error loading dynamically imported module/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading (?:css )?chunk [^\s]+ failed/i,
  /failed to load module script/i,
  /module[^\n]*mime type/i,
];

/** Convert browser, PromiseRejectionEvent, and Angular wrapper shapes into searchable text. */
export function describeAutoReloadError(error: unknown): string {
  return describe(error, new WeakSet<object>(), 0);
}

/** True when an error has the characteristic wording of a missing hashed asset. */
export function isAutoReloadError(
  error: unknown,
  additionalMatchers: readonly AutoReloadErrorMatcher[] = [],
): boolean {
  const text = describeAutoReloadError(error);
  if (CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return additionalMatchers.some((matcher) => {
    if (typeof matcher === 'string') {
      return text.toLocaleLowerCase().includes(matcher.toLocaleLowerCase());
    }
    matcher.lastIndex = 0;
    return matcher.test(text);
  });
}

function describe(value: unknown, seen: WeakSet<object>, depth: number): string {
  if (depth > 6) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    const parts = [value.name, value.message, value.stack ?? ''];
    if ('cause' in value) {
      parts.push(describe(value.cause, seen, depth + 1));
    }
    return parts.filter(Boolean).join('\n');
  }
  if (!isRecord(value)) {
    return String(value);
  }
  if (seen.has(value)) {
    return '';
  }
  seen.add(value);

  const parts: string[] = [];
  for (const key of ['name', 'message', 'stack', 'filename', 'reason', 'rejection', 'error', 'cause']) {
    if (key in value) {
      parts.push(describe(value[key], seen, depth + 1));
    }
  }

  const target = value['target'];
  if (isRecord(target) && typeof target['src'] === 'string') {
    parts.push(target['src']);
  }

  if (parts.some(Boolean)) {
    return parts.filter(Boolean).join('\n');
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

