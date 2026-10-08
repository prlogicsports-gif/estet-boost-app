import { useId, useState, type CSSProperties, type MouseEvent } from "react";

import {
  FACE_EARS,
  FACE_NECK,
  FACE_OUTLINE,
  FACE_VIEWBOX,
  FACE_ZONES,
  type FaceZone,
} from "@/components/facemap/face-data";
import type { FaceMark, FacePoint, MarkState } from "@/lib/face-map-store";
import { cn } from "@/lib/utils";

/**
 * Se existir, a ilustração do rosto (853 x 1110) entra por trás das regiões.
 * Sem ela, o mapa usa a silhueta vetorial e continua inteiro.
 */
export const FACE_IMAGE = "/face-front.png";

const fade = "radial-gradient(ellipse 78% 74% at 50% 46%, #000 62%, transparent 100%)";

function zoneStyle(selected: boolean, hovered: boolean, saved?: MarkState): CSSProperties {
  let fill = "transparent";
  let stroke = "rgba(195,148,142,.55)";
  let width = 0.9;
  if (selected) {
    fill = "rgba(79,175,173,.42)";
    stroke = "var(--eb-teal-500)";
    width = 1.7;
  } else if (saved) {
    fill = saved === "sensitive" ? "rgba(201,109,109,.28)" : "rgba(79,175,173,.2)";
    stroke = saved === "sensitive" ? "var(--eb-coral-500)" : "var(--eb-teal-a40)";
  } else if (hovered) {
    fill = "rgba(195,148,142,.16)";
    stroke = "rgba(220,200,186,.85)";
  } else {
    fill = "rgba(195,148,142,.06)";
  }
  return {
    fill,
    stroke,
    strokeWidth: width,
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
    pointerEvents: "none",
    transition: "fill 200ms cubic-bezier(.32,.72,0,1), stroke 200ms cubic-bezier(.32,.72,0,1)",
  };
}

/** Pontos de uma marcação: os que a esteticista pousou, ou o centroide da região. */
function markPoints(mark: FaceMark, zone: FaceZone): FacePoint[] {
  return mark.points?.length ? mark.points : [{ x: zone.c[0], y: zone.c[1] }];
}

export function FaceMap({
  selected,
  onSelectZone,
  points,
  onAddPoint,
  marks,
  allowPoints = true,
  className,
}: {
  selected: string | null;
  onSelectZone: (zone: FaceZone) => void;
  /** Pontos ainda não salvos da região selecionada. */
  points: FacePoint[];
  onAddPoint: (zoneId: string, point: FacePoint) => void;
  marks: FaceMark[];
  /** Falso na visão da cliente: ela só consulta o mapa. */
  allowPoints?: boolean;
  className?: string;
}) {
  const clipId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [imageOk, setImageOk] = useState(false);

  const saved = marks.reduce<Record<string, MarkState>>((acc, mark) => {
    acc[mark.zoneId] = mark.state;
    return acc;
  }, {});

  /** O primeiro toque seleciona a região; com ela selecionada, o seguinte pousa um ponto. */
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
        "relative w-full overflow-hidden rounded-[var(--radius-xl)] bg-background",
        className,
      )}
      style={{ aspectRatio: `${FACE_VIEWBOX.width} / ${FACE_VIEWBOX.height}` }}
    >
      <img
        src={FACE_IMAGE}
        alt=""
        aria-hidden
        onLoad={() => setImageOk(true)}
        onError={() => setImageOk(false)}
        className={cn(
          "absolute inset-0 size-full object-fill transition-opacity duration-500",
          imageOk ? "opacity-100" : "opacity-0",
        )}
        style={{ WebkitMaskImage: fade, maskImage: fade }}
      />

      <svg
        viewBox={`0 0 ${FACE_VIEWBOX.width} ${FACE_VIEWBOX.height}`}
        role="group"
        aria-label="Mapa facial, vista frontal"
        className="relative block size-full touch-none overflow-visible"
      >
        <defs>
          <radialGradient id={`${clipId}-skin`} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#4a3a40" />
            <stop offset="100%" stopColor="#2b2226" />
          </radialGradient>
          <clipPath id={clipId}>
            <path d={FACE_OUTLINE} />
            {FACE_EARS.map((ear) => (
              <ellipse key={ear.cx} {...ear} />
            ))}
            <path d={FACE_NECK} />
          </clipPath>
        </defs>

        {/* Silhueta vetorial: só aparece enquanto a ilustração não existe. */}
        {!imageOk ? (
          <g fill={`url(#${clipId}-skin)`} stroke="rgba(220,200,186,.22)" strokeWidth={2}>
            <path d={FACE_NECK} />
            {FACE_EARS.map((ear) => (
              <ellipse key={ear.cx} {...ear} />
            ))}
            <path d={FACE_OUTLINE} />
          </g>
        ) : null}

        <g clipPath={`url(#${clipId})`}>
          {FACE_ZONES.map((zone) => (
            <path
              key={zone.id}
              d={zone.d}
              style={zoneStyle(selected === zone.id, hovered === zone.id, saved[zone.id])}
            />
          ))}
        </g>

        {/* Camada de toque: invisível e mais larga que a borda, para o dedo acertar. */}
        <g clipPath={`url(#${clipId})`}>
          {FACE_ZONES.map((zone) => (
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
              className="cursor-pointer outline-none"
              style={{
                fill: "transparent",
                stroke: "transparent",
                strokeWidth: 28,
                strokeLinejoin: "round",
                pointerEvents: "all",
              }}
            />
          ))}
        </g>

        {marks.flatMap((mark) => {
          const zone = FACE_ZONES.find((item) => item.id === mark.zoneId);
          if (!zone) return [];
          return markPoints(mark, zone).map((point, index) => (
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
