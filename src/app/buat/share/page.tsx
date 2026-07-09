"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function SharePage() {
  const router = useRouter();
  const [shortCode, setShortCode] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [roomLink, setRoomLink] = useState("");

  useEffect(() => {
    const code = sessionStorage.getItem("shortCode") || "";
    const merchant = sessionStorage.getItem("merchantName") || "";
    setShortCode(code);
    setMerchantName(merchant);
    if (code) {
      setRoomLink(`${window.location.origin}/room/${code}`);
    }
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(roomLink);
      toast.success("Link berhasil disalin! 📋");
    } catch {
      toast.error("Gagal menyalin link");
    }
  }

  async function shareWhatsApp() {
    const text = `Yuk patungan di ${merchantName || "restoran"}! 🍽️\nBuka link ini untuk pilih menu kamu:\n${roomLink}\n\nDibuat via BagiRata`;

    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BagiRata - Patungan",
          text,
          url: roomLink,
        });
        return;
      } catch {
        // User cancelled or not supported, fall through to WhatsApp
      }
    }

    // Fallback to WhatsApp link
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  }

  function goToRoom() {
    if (shortCode) {
      router.push(`/room/${shortCode}`);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-lg mx-auto w-full">
      <div className="w-full text-center animate-slide-up">
        {/* Success animation */}
        <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">🎉</span>
        </div>

        <h1 className="text-2xl font-bold mb-2">Room Siap!</h1>
        <p className="text-muted-foreground mb-8">
          Bagikan link ini ke teman-teman buat mulai patungan
        </p>

        {/* Link display */}
        <Card className="p-4 rounded-2xl bg-card/80 border-border/50 mb-6">
          <p className="text-xs text-muted-foreground mb-1">Link Room:</p>
          <p className="font-mono text-sm text-primary break-all">
            {roomLink}
          </p>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full">
          <Button
            onClick={copyLink}
            className="w-full h-14 rounded-2xl font-bold text-base"
            variant="outline"
          >
            📋 Salin Tautan
          </Button>

          <Button
            onClick={shareWhatsApp}
            className="w-full h-14 rounded-2xl font-bold text-base bg-[#25D366] hover:bg-[#25D366]/90 text-white"
          >
            💬 Bagikan ke WhatsApp
          </Button>

          <Button
            onClick={goToRoom}
            variant="ghost"
            className="w-full h-12 rounded-xl text-muted-foreground hover:text-foreground mt-2"
          >
            Buka Room sebagai Host →
          </Button>
        </div>
      </div>
    </main>
  );
}
