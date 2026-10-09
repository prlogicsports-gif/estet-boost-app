import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/eb/icon";
import { Button } from "@/components/ui/button";

type Facing = "user" | "environment";

/**
 * Câmera com guia oval para o rosto. A foto sai sempre no mesmo enquadramento (4:5, rosto no oval), então
 * fotos de dias diferentes ficam alinhadas e simétricas para comparar. Se a câmera não abrir (sem permissão
 * ou sem suporte), oferece a câmera do próprio aparelho.
 */
export function FaceCamera({
  open,
  onClose,
  onCapture,
  title,
  initialFacing = "environment",
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title: string;
  initialFacing?: Facing;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallback = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<Facing>(initialFacing);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFacing(initialFacing);
    setFailed(false);
  }, [open, initialFacing]);

  useEffect(() => {
    if (!open) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailed(true);
      return;
    }
    let alive = true;
    stop();
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      })
      .then((stream) => {
        if (!alive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => {});
        }
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stop();
    };
  }, [open, facing, stop]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // recorta o centro no mesmo 4:5 que a tela mostra
    const target = 4 / 5;
    let sw = video.videoWidth;
    let sh = video.videoHeight;
    if (sw / sh > target) sw = sh * target;
    else sh = sw / target;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    const scale = Math.min(1, 1600 / sh);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[120] flex flex-col bg-black"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <button
          type="button"
          aria-label="Fechar câmera"
          onClick={onClose}
          className="grid size-11 place-items-center rounded-full bg-white/10"
        >
          <Icon name="X" size={20} />
        </button>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</span>
        {!failed ? (
          <button
            type="button"
            aria-label="Trocar de câmera"
            onClick={() => setFacing((value) => (value === "user" ? "environment" : "user"))}
            className="grid size-11 place-items-center rounded-full bg-white/10"
          >
            <Icon name="RefreshCw" size={18} />
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {failed ? (
          <div className="flex max-w-[320px] flex-col items-center gap-3 text-center text-white">
            <Icon name="CameraOff" size={30} />
            <p className="text-[14px]">
              Não foi possível abrir a câmera aqui. Libere a câmera para o EstetBoost. nas
              configurações do aparelho, ou use a câmera do aparelho.
            </p>
            <Button type="button" onClick={() => fallback.current?.click()}>
              <Icon name="Camera" size={16} /> Abrir câmera do aparelho
            </Button>
          </div>
        ) : (
          <div className="relative aspect-[4/5] max-h-full w-full max-w-[460px] overflow-hidden rounded-[var(--radius-lg)] bg-[#120d10]">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 size-full object-cover"
              style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
            />
            <svg
              viewBox="0 0 100 125"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                fill="rgba(10,6,8,.55)"
                d="M0 0H100V125H0Z M50 20A30 40 0 1 0 50 100A30 40 0 1 0 50 20Z"
              />
              <ellipse
                cx="50"
                cy="60"
                rx="30"
                ry="40"
                fill="none"
                stroke="#fff"
                strokeWidth="0.7"
                strokeDasharray="2.2 1.6"
              />
              <line
                x1="50"
                y1="24"
                x2="50"
                y2="96"
                stroke="rgba(255,255,255,.35)"
                strokeWidth="0.3"
              />
              <line
                x1="30"
                y1="52"
                x2="70"
                y2="52"
                stroke="rgba(255,255,255,.35)"
                strokeWidth="0.3"
              />
              <line
                x1="40"
                y1="82"
                x2="60"
                y2="82"
                stroke="rgba(255,255,255,.25)"
                strokeWidth="0.3"
              />
            </svg>
            <p className="absolute inset-x-0 bottom-3 px-4 text-center text-[12.5px] text-white drop-shadow">
              {ready ? "Encaixe o rosto no oval, olhos na linha" : "Abrindo a câmera…"}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center py-5">
        {!failed ? (
          <button
            type="button"
            aria-label="Tirar foto"
            disabled={!ready}
            onClick={shoot}
            className="grid size-[72px] place-items-center rounded-full border-4 border-white disabled:opacity-40"
          >
            <span className="size-[54px] rounded-full bg-white" />
          </button>
        ) : null}
      </div>

      <input
        ref={fallback}
        type="file"
        accept="image/*"
        capture={initialFacing}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            onCapture(file);
            onClose();
          }
        }}
      />
    </div>,
    document.body,
  );
}
