import { useId, useState, type MouseEvent } from "react";

import { BODY_MAPS, type BodyKind } from "@/components/facemap/body-data";
import type { FaceZone } from "@/components/facemap/face-data";
import { zoneStyle } from "@/components/facemap/zone-style";
import type { FaceMark, FacePoint, MarkState } from "@/lib/face-map-store";
import { cn } from "@/lib/utils";

/**
 * Mapa de corpo (abdômen ou glúteo): silhueta vetorial com as regiões tocáveis. Funciona como o mapa facial:
 * o primeiro toque seleciona a região; com ela selecionada, o seguinte pousa um ponto de ação.
 */
export function BodyMap({
  kind,
  selected,
  onSelectZone,
  points,
  onAddPoint,
  marks,
  allowPoints = true,
  className,
}: {
  kind: BodyKind;
  selected: string | null;
  onSelectZone: (zone: FaceZone) => void;
  points: FacePoint[];
  onAddPoint: (zoneId: string, point: FacePoint) => void;
  marks: FaceMark[];
  allowPoints?: boolean;
  className?: string;
}) {
  const def = BODY_MAPS[kind];
  const id = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  const saved = marks.reduce<Record<string, MarkState>>((acc, mark) => {
    acc[mark.zoneId] = mark.state;
    return acc;
  }, {});

  function tap(zone: FaceZone, event: MouseEvent<SVGPathElement>) {
    if (selected !== zone.id) {
      onSelectZone(zone);
      return;
    }
    if (!allowPoints) return;
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    onAddPoint(zone.id, { x: Math.round(local.x), y: Math.round(local.y) });
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[var(--radius-xl)] bg-[#1d1719]",
        className,
      )}
      style={{ aspectRatio: `${def.viewBox.width} / ${def.viewBox.height}` }}
    >
      <svg
        viewBox={`0 0 ${def.viewBox.width} ${def.viewBox.height}`}
        role="group"
        aria-label={def.ariaLabel}
        className="relative block size-full touch-none overflow-visible"
      >
        <defs>
          <radialGradient id={`${id}-skin`} cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#5b484d" />
            <stop offset="100%" stopColor="#2b2226" />
          </radialGradient>
          <clipPath id={`${id}-clip`}>
            <path d={def.outline} />
          </clipPath>
        </defs>

        <path
          d={def.outline}
          fill={`url(#${id}-skin)`}
          stroke="rgba(220,200,186,.3)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <g
          fill="none"
          stroke="rgba(220,200,186,.2)"
          strokeWidth={2}
          strokeLinecap="round"
          className="pointer-events-none"
        >
          {def.details.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        <g clipPath={`url(#${id}-clip)`}>
          {def.zones.map((zone) => (
            <path
              key={zone.id}
              data-zona={zone.id}
              d={zone.d}
              style={zoneStyle(selected === zone.id, hovered === zone.id, saved[zone.id])}
            />
          ))}
        </g>

        <g clipPath={`url(#${id}-clip)`}>
          {def.zones.map((zone) => (
            <path
              key={zone.id}
              d={zone.d}
              tabIndex={0}
              role="button"
              aria-label={zone.nome}
              aria-pressed={selected === zone.id}
              onClick={(event) => tap(zone, event)}
              onPointerEnter={() => setHovered(zone.id)}
              onPointerLeave={() => setHovered((current) => (current === zone.id ? null : current))}
              onFocus={() => setHovered(zone.id)}
              onBlur={() => setHovered((current) => (current === zone.id ? null : current))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectZone(zone);
                }
              }}
              className="outline-none"
              style={{
                fill: "transparent",
                stroke: "transparent",
                strokeWidth: 20,
                strokeLinejoin: "round",
                pointerEvents: "all",
                cursor: "pointer",
              }}
            />
          ))}
        </g>

        {marks.flatMap((mark) => {
          const zone = def.zones.find((item) => item.id === mark.zoneId);
          const anchor = zone?.c ? { x: zone.c[0], y: zone.c[1] } : null;
          const pts = mark.points?.length ? mark.points : anchor ? [anchor] : [];
          return pts.map((point, index) => (
            <circle
              key={`${mark.id}-${index}`}
              cx={point.x}
              cy={point.y}
              r={11}
              fill="var(--eb-teal-500)"
              stroke="rgba(20,14,17,.45)"
              strokeWidth={2}
              className="pointer-events-none"
            />
          ));
        })}

        {points.map((point, index) => (
          <g
            key={`novo-${index}`}
            className="pointer-events-none"
            style={{
              transformOrigin: `${point.x}px ${point.y}px`,
              animation: "point-in 200ms cubic-bezier(.16,1,.3,1) both",
            }}
          >
            <circle cx={point.x} cy={point.y} r={20} fill="rgba(79,175,173,.22)" />
            <circle
              cx={point.x}
              cy={point.y}
              r={11}
              fill="var(--eb-teal-500)"
              stroke="rgba(20,14,17,.45)"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
