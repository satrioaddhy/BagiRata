"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useScanJob } from "@/hooks/use-scan-job";

type Phase = "upload" | "scanning" | "failed";

export default function BuatPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { status, result, error } = useScanJob(jobId);

  // Handle scan job status changes
  useEffect(() => {
    if (status === "done" && result && jobId) {
      // Store result in sessionStorage and navigate to review
      sessionStorage.setItem("scanResult", JSON.stringify(result));
      sessionStorage.setItem("scanJobId", jobId);
      sessionStorage.removeItem("reviewDraft");
      router.push("/buat/review");
    }
  }, [status, result, jobId, router]);

  useEffect(() => {
    if (status === "failed" && phase !== "failed") {
      setPhase("failed");
      toast.error(error || "Gagal membaca struk");
    }
  }, [status, phase, error]);


  async function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setPhase("scanning");

    try {
      // Compress to ≤ 1MB
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // Upload to /api/scan
      const formData = new FormData();
      formData.append("image", compressed);

      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload gagal");
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunggah gambar"
      );
      setPhase("failed");
    } finally {
      setUploading(false);
    }
  }

  function goToManualEntry() {
    sessionStorage.removeItem("scanResult");
    sessionStorage.removeItem("scanJobId");
    sessionStorage.removeItem("reviewDraft");
    router.push("/buat/review");
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="mb-6 animate-slide-up">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-bold">Foto Struk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ambil foto atau pilih dari galeri. AI akan membaca item-itemnya.
        </p>
      </div>

      {phase === "upload" && (
        <div className="flex-1 flex flex-col gap-4 animate-slide-up">
          {/* Upload Zone */}
          <Card
            className="flex-1 min-h-[300px] flex flex-col items-center justify-center
                       border-2 border-dashed border-primary/30 hover:border-primary/60
                       cursor-pointer transition-all duration-300 rounded-2xl
                       bg-primary/5 hover:bg-primary/10"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📷</span>
              </div>
              <p className="font-semibold text-lg mb-1">
                Ketuk untuk foto struk
              </p>
              <p className="text-sm text-muted-foreground">
                atau pilih gambar dari galeri
              </p>
            </div>
          </Card>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {/* Manual entry option */}
          <Button
            variant="ghost"
            onClick={goToManualEntry}
            className="text-muted-foreground hover:text-foreground"
          >
            ✏️ Masukkan manual tanpa foto
          </Button>
        </div>
      )}

      {phase === "scanning" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
          {/* Preview with scan animation */}
          <div className="relative w-full max-w-[280px] aspect-[3/4] rounded-2xl overflow-hidden border border-border">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full h-full object-cover opacity-60"
              />
            )}
            {/* Scan line animation */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-primary/20">
              <div className="absolute left-0 right-0 h-1 bg-primary/60 shadow-[0_0_15px] shadow-primary/50 animate-scan-line" />
            </div>
          </div>

          <div className="text-center">
            <p className="font-semibold text-lg mb-1">
              {uploading ? "Mengunggah..." : "Sedang membaca struk..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {uploading
                ? "Mengompres dan mengunggah gambar"
                : "AI sedang mengekstrak item dari struk kamu"}
            </p>
          </div>

          {/* Animated dots */}
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      {phase === "failed" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
            <span className="text-4xl">😅</span>
          </div>

          <div className="text-center">
            <p className="font-semibold text-lg mb-1">
              Ups, gagal membaca struk
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {error ||
                "Tidak apa-apa! Kamu bisa masukkan item secara manual."}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              onClick={goToManualEntry}
              className="w-full h-12 rounded-xl font-semibold"
            >
              ✏️ Masukkan Manual
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPhase("upload");
                setJobId(null);
                setPreview(null);
              }}
              className="w-full h-12 rounded-xl"
            >
              📷 Coba Foto Lagi
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
