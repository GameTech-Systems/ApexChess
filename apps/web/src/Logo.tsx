/**
 * The Apex Chess mark: a plain 8×8 board standing on its corner, light corners top and bottom, no
 * coordinates. It is a logo, not game data (reserved; see NOTICE), so its size is fixed here.
 */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const cells = [];
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      const x = f + r - 7;
      const y = f - r;
      cells.push(
        <polygon
          key={`${f}${r}`}
          className={(f + r) % 2 === 1 ? "logo-light" : "logo-dark"}
          points={`${x},${y - 1} ${x + 1},${y} ${x},${y + 1} ${x - 1},${y}`}
        />,
      );
    }
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="-8.4 -8.4 16.8 16.8"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {cells}
      <polygon className="logo-edge" points="0,-8 8,0 0,8 -8,0" />
    </svg>
  );
}
