function metaText(meta: unknown): string {
  try {
    return JSON.stringify(meta) ?? '';
  } catch {
    return '';
  }
}

export function isHoursViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as { message?: unknown; constraint?: unknown; meta?: unknown; cause?: unknown };
    if (/Venue_hours_check/.test(`${String(o.message ?? '')} ${String(o.constraint ?? '')} ${metaText(o.meta)}`)) return true;
    e = o.cause;
  }
  return false;
}
