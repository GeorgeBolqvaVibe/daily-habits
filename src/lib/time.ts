export function timeStringToDate(s: string | null | undefined): Date {
  const m = s ? /^(\d{1,2}):(\d{2})$/.exec(s) : null;
  const d = new Date();
  d.setSeconds(0, 0);
  if (m) {
    d.setHours(Math.max(0, Math.min(23, Number(m[1]))));
    d.setMinutes(Math.max(0, Math.min(59, Number(m[2]))));
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

export function dateToTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function format12h(s: string | null | undefined): string {
  const m = s ? /^(\d{1,2}):(\d{2})$/.exec(s) : null;
  if (!m) return '';
  let h = Number(m[1]);
  const mm = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mm} ${ampm}`;
}
