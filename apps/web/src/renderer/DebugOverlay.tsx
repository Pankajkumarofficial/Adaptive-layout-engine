import type { AdSpec, LayoutResult } from '@ale/engine';

export interface DebugOverlayProps {
  spec: AdSpec;
  result: LayoutResult;
  scale: number;
}

/**
 * A registration overlay, not a devtools inspector: regions as dashed plates,
 * frames as corner ticks, and each element tagged with the priority that
 * decides whether it survives the next surface.
 */
/**
 * Labels get an opaque plate. Without one they stack illegibly over each other
 * and over the artwork as soon as the canvas is scaled down, which is exactly
 * when you most need to read them.
 */
function Tag({
  x,
  y,
  scale,
  tone,
  text,
}: {
  x: number;
  y: number;
  scale: number;
  tone: 'guide' | 'ink';
  text: string;
}) {
  const size = 9 / scale;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={text.length * size * 0.62 + size * 0.7}
        height={size * 1.45}
        className="fill-card"
        opacity={0.88}
        rx={1 / scale}
      />
      <text
        x={x + size * 0.35}
        y={y + size * 1.1}
        className={tone === 'guide' ? 'fill-guide' : 'fill-ink'}
        stroke="none"
        fontSize={size}
        fontFamily="Courier Prime, monospace"
      >
        {text}
      </text>
    </g>
  );
}

export function DebugOverlay({ spec, result, scale }: DebugOverlayProps) {
  const priorityOf = new Map(spec.elements.map((el) => [el.id, el.priority]));
  const { width, height } = result.surface;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <g fill="none" className="stroke-guide">
        {Object.entries(result.regions).map(([key, r]) => (
          <g key={key} opacity={key === 'bleed' ? 0.25 : 0.5}>
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              strokeWidth={1 / scale}
              strokeDasharray={`${6 / scale} ${4 / scale}`}
            />
            <Tag x={r.x + 2 / scale} y={r.y + 2 / scale} scale={scale} tone="guide" text={key} />
          </g>
        ))}
      </g>

      <g>
        {result.placed.map((p) => {
          const tick = Math.min(10, Math.min(p.frame.w, p.frame.h) / 3) / scale;
          const { x, y, w, h } = p.frame;
          return (
            <g key={p.id}>
              {/* Corner ticks read as registration marks rather than a box that
                  competes with the artwork underneath. */}
              <path
                d={`M${x} ${y + tick} V${y} H${x + tick}
                    M${x + w - tick} ${y} H${x + w} V${y + tick}
                    M${x + w} ${y + h - tick} V${y + h} H${x + w - tick}
                    M${x + tick} ${y + h} H${x} V${y + h - tick}`}
                fill="none"
                className="stroke-ink"
                strokeWidth={1.5 / scale}
                opacity={0.95}
              />
              <Tag
                x={x + 2 / scale}
                y={y + h - 12 / scale}
                scale={scale}
                tone="ink"
                text={`${p.id}\u2009p${priorityOf.get(p.id) ?? '?'}`}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
