import type { CSSProperties } from 'react';
import type { AdElement, AdSpec, LayoutResult, PlacedElement, Surface } from '@ale/engine';

export interface AdRendererProps {
  spec: AdSpec;
  surface: Surface;
  result: LayoutResult;
  /** Display scale. Purely presentational — the engine solved at 1:1. */
  scale: number;
}

/**
 * Paints a LayoutResult. That is all it does.
 *
 * There is deliberately no sizing, no wrapping, no fitting and no alignment
 * arithmetic anywhere below this line: every number comes from `result`. If a
 * position ever needs computing here, it belongs in the engine instead — that
 * rule is what keeps the server-side solve and the browser identical.
 */
export function AdRenderer({ spec, surface, result, scale }: AdRendererProps) {
  const byId = new Map(spec.elements.map((el) => [el.id, el]));

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: surface.width,
        height: surface.height,
        background: spec.theme.palette.bg,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        fontFamily: spec.theme.fontFamily,
      }}
      role="img"
      aria-label={`${spec.name} rendered at ${surface.width} by ${surface.height}`}
    >
      {result.placed.map((placed) => {
        const element = byId.get(placed.id);
        if (element === undefined) return null;
        return <PlacedNode key={placed.id} placed={placed} element={element} spec={spec} />;
      })}
    </div>
  );
}

function PlacedNode({
  placed,
  element,
  spec,
}: {
  placed: PlacedElement;
  element: AdElement;
  spec: AdSpec;
}) {
  const frame: CSSProperties = {
    position: 'absolute',
    left: placed.frame.x,
    top: placed.frame.y,
    width: placed.frame.w,
    height: placed.frame.h,
    opacity: placed.opacity,
    zIndex: placed.z,
  };

  if (element.content.kind === 'shape') {
    return <div style={{ ...frame, background: placed.fill ?? element.content.fill }} />;
  }

  if (element.content.kind === 'image') {
    const crop = placed.imageCrop;
    // Scale the source so the crop window exactly covers the frame, then slide
    // it so the window's top-left lands on the frame's top-left.
    const zoom = crop !== undefined ? placed.frame.w / crop.sw : 1;
    return (
      <div style={{ ...frame, overflow: 'hidden', borderRadius: element.aspectLock ? 0 : 2 }}>
        <img
          src={element.content.url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: crop !== undefined ? -crop.sx * zoom : 0,
            top: crop !== undefined ? -crop.sy * zoom : 0,
            width: element.content.intrinsic.w * zoom,
            height: element.content.intrinsic.h * zoom,
            maxWidth: 'none',
          }}
        />
      </div>
    );
  }

  const isChip = element.role === 'cta';
  return (
    <div style={frame}>
      {placed.scrim !== undefined && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            // The scrim reaches past the text box so its edge is not a visible
            // seam; the engine sized the opacity, this only softens the falloff.
            inset: '-14% -6%',
            background: `linear-gradient(to bottom, transparent, ${placed.scrim.fill} 22%, ${placed.scrim.fill} 78%, transparent)`,
            opacity: placed.scrim.opacity,
            borderRadius: 4,
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems:
            placed.textAlign === 'left'
              ? 'flex-start'
              : placed.textAlign === 'right'
                ? 'flex-end'
                : 'center',
          textAlign: placed.textAlign ?? 'center',
          background: isChip ? (placed.fill ?? spec.theme.palette.ctaBg) : undefined,
          borderRadius: isChip ? spec.theme.cornerRadius : undefined,
          color: placed.color ?? spec.theme.palette.fg,
          fontSize: placed.fontSizePx,
          lineHeight: `${placed.lineHeightPx ?? 0}px`,
          fontWeight: WEIGHT_BY_ROLE[element.role] ?? 400,
        }}
      >
        {/* One span per line: the engine already wrapped this text, and letting
            the browser re-wrap would make the rendered layout disagree with the
            solved one. */}
        {(placed.lines ?? []).map((line, i) => (
          <span key={i} style={{ display: 'block', whiteSpace: 'pre' }}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mirrors ROLE_DEFAULTS in the engine, which is what the estimator measured. */
const WEIGHT_BY_ROLE: Record<string, number> = {
  headline: 700,
  subhead: 500,
  body: 400,
  cta: 600,
  legal: 400,
  badge: 600,
  logo: 600,
};
