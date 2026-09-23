import { useEffect, useState } from "react";

import photo1 from "@/assets/images/auth/estetboost-auth-1.jpg";
import photo2 from "@/assets/images/auth/estetboost-auth-2.jpg";
import photo3 from "@/assets/images/auth/estetboost-auth-3.jpg";
import photo4 from "@/assets/images/auth/estetboost-auth-4.jpg";

const photos = [photo1, photo2, photo3, photo4];

export function AuthCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {photos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          loading={i === 0 ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms]"
          style={{ opacity: i === index ? 1 : 0, transform: "scale(1.06)" }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />

      <div className="absolute inset-x-0 bottom-0 p-8 lg:p-12">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--nude-sand)]">
          Cuidado organizado · Negócio em evolução
        </p>
        <h2 className="mt-3 max-w-md text-2xl font-light leading-snug text-foreground lg:text-3xl">
          O seu estúdio, inteiro numa tela.
        </h2>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Agenda, clientes, anamneses, mapa facial e caixa — no mesmo lugar, do atendimento ao retorno.
        </p>
        <div className="mt-6 flex gap-2" aria-hidden>
          {photos.map((src, i) => (
            <span
              key={src}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i === index ? 28 : 10,
                background: i === index ? "var(--primary)" : "var(--glass-border)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
