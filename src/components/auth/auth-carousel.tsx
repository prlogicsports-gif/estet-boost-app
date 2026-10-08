import { useEffect, useState } from "react";

import photo1 from "@/assets/images/auth/estetboost-auth-1.jpg";
import photo2 from "@/assets/images/auth/estetboost-auth-2.jpg";
import photo3 from "@/assets/images/auth/estetboost-auth-3.jpg";
import photo4 from "@/assets/images/auth/estetboost-auth-4.jpg";
import photo5 from "@/assets/images/auth/estetboost-auth-5.jpg";
import photo6 from "@/assets/images/auth/estetboost-auth-6.jpg";

const photos = [photo1, photo2, photo3, photo4, photo5, photo6];

/** Desfoque progressivo na base da foto, como no protótipo. */
const blurs = [
  { height: 340, blur: "blur(4px)", stop: "55%" },
  { height: 250, blur: "blur(12px)", stop: "60%" },
  { height: 168, blur: "blur(26px) saturate(.92)", stop: "62%" },
];

export function AuthCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-[300px] flex-col overflow-hidden border-b border-[var(--border-hairline)] bg-[var(--eb-plum-800)] px-5 pb-7 min-[901px]:min-h-[520px] min-[901px]:border-b-0 min-[901px]:border-r min-[901px]:px-12 min-[901px]:pb-12">
      <div className="absolute inset-0 overflow-hidden">
        {photos.map((src, i) => (
          <div
            key={src}
            aria-hidden
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1400ms]"
            style={{
              backgroundImage: `url("${src}")`,
              transform: "scale(1.32)",
              opacity: i === index ? 1 : 0,
            }}
          />
        ))}
        {blurs.map((layer) => (
          <div
            key={layer.height}
            className="absolute inset-x-0 bottom-0"
            style={{
              height: layer.height,
              backdropFilter: layer.blur,
              WebkitBackdropFilter: layer.blur,
              maskImage: `linear-gradient(180deg, transparent 0%, #000 ${layer.stop})`,
              WebkitMaskImage: `linear-gradient(180deg, transparent 0%, #000 ${layer.stop})`,
            }}
          />
        ))}
        <div
          className="absolute inset-x-0 bottom-0 h-[340px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(36,28,32,0) 0%, rgba(36,28,32,.34) 42%, rgba(36,28,32,.62) 72%, rgba(36,28,32,.78) 100%)",
          }}
        />
      </div>

      <div className="relative z-[1] mt-auto max-w-[420px]">
        <div className="mb-5 flex gap-[7px]" aria-hidden>
          {photos.map((src, i) => (
            <span
              key={src}
              className="h-[7px] rounded-full transition-all duration-200"
              style={{
                width: i === index ? 22 : 7,
                background: i === index ? "var(--eb-nude-500)" : "var(--eb-nude-a32)",
              }}
            />
          ))}
        </div>
        <span className="text-[11px] font-medium uppercase leading-none tracking-[0.14em] text-[var(--nude-sand)]">
          Cuidado organizado · Negócio em evolução
        </span>
        <h2 className="mt-3.5 text-[28px] font-light leading-[1.12] tracking-[-0.02em] text-foreground min-[901px]:text-[34px]">
          O seu estúdio,
          <br />
          <span className="font-medium">inteiro numa tela.</span>
        </h2>
        <p className="mt-3.5 text-[15px] leading-[1.55] text-[var(--text-secondary)]">
          Agenda, clientes, anamneses, mapa facial e caixa — no mesmo lugar, do atendimento ao
          retorno.
        </p>
      </div>
    </div>
  );
}
