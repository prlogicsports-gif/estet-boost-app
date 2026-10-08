import {
  useId,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import {
  FACE_EARS,
  FACE_NECK,
  FACE_OUTLINE,
  FACE_VIEWBOX,
  type FaceZone,
} from "@/components/facemap/face-data";
import { useFaceLayout, type ResolvedLayout } from "@/lib/face-layout";
import type { FaceMark, FacePoint, MarkState } from "@/lib/face-map-store";
import { cn } from "@/lib/utils";

/**
 * Ilustração do rosto (853 x 1110) por trás das regiões. Se o arquivo faltar, o mapa
 * usa a silhueta vetorial e continua inteiro.
 */
export const FACE_IMAGE = "/face-front.jpg";

function zoneStyle(selected: boolean, hovered: boolean, saved?: MarkState): CSSProperties {
  let fill = "rgba(195,148,142,.06)";
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

export function FaceMap({
  selected,
  onSelectZone,
  points,
  onAddPoint,
  marks,
  allowPoints = true,
  editing = false,
  onZonePointerDown,
  overlay,
  svgRef,
  layout: layoutOverride,
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
  /** No editor: arrastar a região move a região, e a camada de toque não reage a cliques. */
  editing?: boolean;
  onZonePointerDown?: ((zone: FaceZone, event: PointerEvent<SVGPathElement>) => void) | undefined;
  /** Camada livre acima das regiões (alças do editor, rascunho de região nova). */
  overlay?: ReactNode;
  svgRef?: RefObject<SVGSVGElement | null>;
  /** O editor passa o rascunho; sem isso vale o layout salvo. */
  layout?: ResolvedLayout;
  className?: string;
}) {
  const clipId = useId();
  const saved_ = useFaceLayout();
  const layout = layoutOverride ?? saved_;
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
        "relative w-full overflow-hidden rounded-[var(--radius-xl)] bg-[#1d1719]",
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
      />

      <svg
        ref={svgRef}
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
          {Object.entries(layout.masks).map(([id, d]) => (
            <mask
              key={id}
              id={`${clipId}-mask-${id}`}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={FACE_VIEWBOX.width}
              height={FACE_VIEWBOX.height}
            >
              <rect
                x={0}
                y={0}
                width={FACE_VIEWBOX.width}
                height={FACE_VIEWBOX.height}
                fill="#fff"
              />
              <path d={d} fill="#000" />
            </mask>
          ))}
        </defs>

        {/* Contorno do rosto: referência para o editor saber o que é "dentro". */}
        <path
          className="eb-limite"
          d={`${FACE_OUTLINE} ${FACE_NECK}`}
          fill="transparent"
          style={{ pointerEvents: "none" }}
        />

        {/* Silhueta vetorial: só aparece enquanto a ilustração não carrega. */}
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
          {layout.zones.map((zone) => (
            <path
              key={zone.id}
              className="eb-zona"
              data-zona={zone.id}
              d={zone.d}
              transform={layout.transforms[zone.id]}
              mask={layout.masks[zone.id] ? `url(#${clipId}-mask-${zone.id})` : undefined}
              style={zoneStyle(selected === zone.id, hovered === zone.id, saved[zone.id])}
            />
          ))}
        </g>

        {/* Camada de toque: invisível e mais larga que a borda, para o dedo acertar. */}
        <g clipPath={`url(#${clipId})`}>
          {layout.zones.map((zone) => (
            <path
              key={zone.id}
              d={zone.d}
              transform={layout.transforms[zone.id]}
              tabIndex={0}
              role="button"
              aria-label={layout.nameOf(zone.id)}
              aria-pressed={selected === zone.id}
              onPointerDown={
                onZonePointerDown ? (event) => onZonePointerDown(zone, event) : undefined
              }
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
                strokeWidth: 28,
                strokeLinejoin: "round",
                pointerEvents: "all",
                cursor: editing ? "move" : "pointer",
              }}
            />
          ))}
        </g>

        {marks.flatMap((mark) => {
          const anchor = layout.anchorOf(mark.zoneId);
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

        {overlay}
      </svg>
    </div>
  );
}
