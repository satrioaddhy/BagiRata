"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md mx-auto animate-slide-up">
        {/* Logo / App Name */}
        <div className="mb-2">
          <div className="w-20 h-20 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 mx-auto">
            <span className="text-4xl">🧾</span>
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-gradient mb-3">
          BagiRata
        </h1>

        <p className="text-lg text-muted-foreground mb-2 font-medium">
          Patungan Jadi Mudah ✨
        </p>

        <p className="text-sm text-muted-foreground/80 mb-10 max-w-xs leading-relaxed">
          Foto struk, undang teman lewat link, dan setiap orang langsung tahu
          berapa yang harus dibayar. Adil, cepat, tanpa ribet.
        </p>

        {/* Primary CTA */}
        <Button
          size="lg"
          onClick={() => router.push("/buat")}
          className="w-full max-w-xs h-14 text-lg font-bold rounded-2xl animate-pulse-glow
                     bg-primary text-primary-foreground hover:bg-primary/90
                     transition-all duration-300 active:scale-95"
        >
          📸 Buat Tagihan Baru
        </Button>

        {/* Secondary info */}
        <div className="mt-12 flex flex-col gap-4 w-full max-w-xs stagger-children">
          <FeatureCard
            emoji="📷"
            title="Foto Struk"
            description="AI baca struk otomatis"
          />
          <FeatureCard
            emoji="🔗"
            title="Bagikan Link"
            description="Teman buka tanpa install"
          />
          <FeatureCard
            emoji="✅"
            title="Pilih Menu"
            description="Centang apa yang kamu makan"
          />
          <FeatureCard
            emoji="💰"
            title="Bayar Pas"
            description="Hitung adil sampai rupiah"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-4 text-left">
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
