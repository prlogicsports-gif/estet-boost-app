import { useEffect, useRef, useState } from "react";

import { FACE_IMAGE } from "@/components/facemap/face-map";
import { Icon } from "@/components/eb/icon";
import { StatusBadge } from "@/components/eb/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScanSuggestion = {
  id: string;
  zoneId: string;
  zoneLabel: string;
  observation: string;
  product?: string;
  inStock?: string;
};

function Viewfinder({
  stream,
  videoRef,
  captured,
  label,
}: {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captured: string | null;
  label: string;
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-card)] bg-[var(--eb-plum-900)]">
      {captured && captured !== "demo" ? (
        <img
          src={captured}
          alt="Fotografia capturada para análise"
          className="size-full object-contain"
        />
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="size-full object-cover"
            style={{ display: stream ? "block" : "none" }}
          />
          {!stream ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-30"
              style={{ backgroundImage: `url(${FACE_IMAGE})` }}
            />
          ) : null}
        </>
      )}
      <svg
        viewBox="0 0 300 400"
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      >
        <ellipse
          cx={150}
          cy={186}
          rx={96}
          ry={126}
          fill="none"
          stroke="var(--eb-teal-a40)"
          strokeWidth={1.6}
          strokeDasharray="10 8"
        />
        {(
          [
            [24, 24, 1, 1],
            [276, 24, -1, 1],
            [24, 376, 1, -1],
            [276, 376, -1, -1],
          ] as const
        ).map(([x, y, sx, sy]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x + sx * 26},${y} L${x},${y} L${x},${y + sy * 26}`}
            fill="none"
            stroke="var(--eb-nude-300)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <span className="absolute inset-x-3 bottom-3 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] px-3 py-[7px] text-center text-xs backdrop-blur-[12px]">
        {label}
      </span>
    </div>
  );
}

/**
 * Análise por câmera: assistida, nunca diagnóstica. A câmera enquadra o rosto,
 * a esteticista captura e a EstetBoost propõe pontos de atenção já mapeados nas
 * regiões do rosto, com produtos do estoque. Nada vai ao prontuário sem confirmação.
 */
export function SkinScan({
  suggestions,
  clientName,
  onConfirm,
  onOpenZone,
}: {
  suggestions: ScanSuggestion[];
  clientName?: string | undefined;
  onConfirm: (accepted: ScanSuggestion[]) => void;
  onOpenZone?: (suggestion: ScanSuggestion) => void;
}) {
  const [stage, setStage] = useState<"frame" | "review">("frame");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>(() => suggestions.map((item) => item.id));
  const [denied, setDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);
  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const startCamera = async () => {
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }));
    } catch {
      setDenied(true);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (video && stream && video.videoWidth) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      setCaptured(canvas.toDataURL("image/png"));
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    } else {
      // Sem câmera liberada, o enquadramento de demonstração faz o papel da captura.
      setCaptured("demo");
    }
    setStage("review");
  };

  const toggle = (id: string) =>
    setAccepted((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const retake = () => {
    setCaptured(null);
    setStage("frame");
  };

  const viewfinderLabel = captured
    ? captured === "demo"
      ? "Enquadramento de demonstração"
      : "Fotografia registrada"
    : stream
      ? "Alinhe o rosto ao guia e capture"
      : "Pré-visualização: ative a câmera para capturar";

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-4">
      <div className="flex flex-col gap-3">
        <Viewfinder
          stream={stream}
          videoRef={videoRef}
          captured={captured}
          label={viewfinderLabel}
        />
        {denied && !captured ? (
          <p className="flex items-center gap-[7px] text-xs text-[var(--eb-amber-500)]">
            <Icon name="CameraOff" size={14} /> Sem acesso à câmera. Você pode capturar depois ou
            anexar uma foto da galeria.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {captured ? (
            <Button type="button" variant="secondary" onClick={retake}>
              <Icon name="RotateCcw" size={18} /> Nova captura
            </Button>
          ) : (
            <>
              {stream ? (
                <Button type="button" variant="tech" onClick={capture}>
                  <Icon name="Camera" size={18} /> Capturar
                </Button>
              ) : (
                <Button type="button" onClick={startCamera}>
                  <Icon name="Camera" size={18} /> Ativar câmera
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={capture}>
                <Icon name="Image" size={18} /> Da galeria
              </Button>
            </>
          )}
        </div>
        <p className="flex items-start gap-2 text-[11.5px] leading-[1.6] text-muted-foreground">
          <Icon name="Info" size={13} className="mt-0.5 flex-none" />
          <span>
            A EstetBoost organiza pontos de atenção e sugere produtos do seu estoque. Não é
            diagnóstico e nada vai para o prontuário sem a sua confirmação.
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-medium uppercase leading-[1.2] tracking-[0.14em] text-muted-foreground">
            Pontos de atenção sugeridos
          </span>
          <StatusBadge tone="info" size="sm" icon="Sparkles">
            A confirmar
          </StatusBadge>
        </div>
        {stage === "frame" ? (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Capture uma fotografia para a EstetBoost organizar os pontos de atenção por região
            {clientName ? ` de ${clientName}` : ""}.
          </p>
        ) : (
          <>
            {suggestions.map((item) => {
              const on = accepted.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-[var(--radius-md)] border px-3.5 py-3 transition-colors",
                    on
                      ? "border-[var(--eb-teal-a40)] bg-[var(--eb-teal-a12)]"
                      : "border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)]",
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-[11px]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(item.id)}
                      aria-label={`Aceitar ponto de atenção em ${item.zoneLabel}`}
                      className="mt-0.5 size-[18px] flex-none accent-[var(--teal)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.zoneLabel}</span>
                      <span className="mt-0.5 block text-[12.5px] text-[var(--text-secondary)]">
                        {item.observation}
                      </span>
                    </span>
                  </label>
                  {item.product ? (
                    <div className="mt-2.5 flex items-center gap-[9px] border-t border-[var(--border-hairline)] pt-2.5">
                      <Icon name="Package" size={14} color="var(--eb-nude-300)" />
                      <span className="min-w-0 flex-1 text-[12.5px]">
                        {item.product}
                        <span className="block text-[11px] text-muted-foreground">
                          {item.inStock ? `No seu estoque · ${item.inStock}` : "Fora de estoque"}
                        </span>
                      </span>
                      {item.inStock ? null : (
                        <StatusBadge tone="pending" size="sm">
                          Repor
                        </StatusBadge>
                      )}
                    </div>
                  ) : null}
                  {onOpenZone ? (
                    <button
                      type="button"
                      onClick={() => onOpenZone(item)}
                      className="mt-1 min-h-11 text-[12.5px] text-[var(--teal)]"
                    >
                      Abrir no mapa facial
                    </button>
                  ) : null}
                </div>
              );
            })}
            <Button
              type="button"
              variant="tech"
              className="w-full"
              disabled={!accepted.length}
              onClick={() => onConfirm(suggestions.filter((item) => accepted.includes(item.id)))}
            >
              <Icon name="Check" size={18} />
              {accepted.length
                ? `Confirmar ${accepted.length} ponto${accepted.length > 1 ? "s" : ""}`
                : "Selecione ao menos um ponto"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
