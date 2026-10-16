// The CHECK "Venue_hours_check" of migration f003 refused a venue row. The driver adapter can wrap the database
// error, so the constraint name is searched on the error and its causes. Only this constraint maps to the hours text.
export function isHoursViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const o = e as { message?: unknown; constraint?: unknown; meta?: unknown; cause?: unknown };
    let meta = '';
    try {
      meta = JSON.stringify(o.meta) ?? '';
    } catch {
      // A circular meta object holds no constraint name worth reading.
    }
    if (/Venue_hours_check/.test(`${String(o.message ?? '')} ${String(o.constraint ?? '')} ${meta}`)) return true;
    e = o.cause;
  }
  return false;
}
