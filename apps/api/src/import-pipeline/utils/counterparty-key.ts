const UMLAUT_MAP: Record<string, string> = {
  'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
  'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue',
};

export function counterpartyKey(input: string | null | undefined): string {
  if (!input) return '';
  let s = input;
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    s = s.split(from).join(to);
  }
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9 ]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}
