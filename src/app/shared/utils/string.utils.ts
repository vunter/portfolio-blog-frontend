export function getInitials(name: string): string {
  if (!name || !name.trim()) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';
}
