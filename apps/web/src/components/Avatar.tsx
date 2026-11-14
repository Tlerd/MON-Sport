import type { CSSProperties } from 'react';

/** Vietnamese names put the given name last: "Nguyễn Văn An" shows "A". */
export const initial = (name: string) =>
  [...(name.normalize('NFC').trim().split(/\s+/).at(-1) ?? '')][0] ?? '';

/** Circular monogram avatar styled with `.av` tokens. */
export function Avatar({
  name,
  size = 36,
  color = 'var(--ok)',
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <span
      className="av"
      style={{ '--s': `${size}px`, '--c': color } as CSSProperties}
      aria-hidden="true"
    >
      {initial(name)}
    </span>
  );
}
