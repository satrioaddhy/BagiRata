import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center animate-slide-up">
        <span className="text-6xl block mb-6">🤷</span>
        <h1 className="text-2xl font-bold mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-muted-foreground mb-8 max-w-xs">
          Link yang kamu cari tidak ada atau sudah kedaluwarsa.
        </p>
        <Link href="/">
          <Button className="rounded-xl h-12 px-8 font-semibold">
            🏠 Kembali ke Beranda
          </Button>
        </Link>
      </div>
    </main>
  );
}
