# BagiRata (MVP)

BagiRata adalah aplikasi web mobile-first berbahasa Indonesia yang dirancang untuk membantu sekelompok orang membagi tagihan makanan secara adil dan cepat. Host (orang yang membayar) mengambil foto struk pembayaran, AI (Google Gemini 2.5 Flash) mengekstrak item-item menu, dan teman-teman (guest) tinggal membuka link tanpa perlu login/instal aplikasi untuk memilih apa saja yang mereka makan. Setelah semua memilih, nominal tagihan per orang dihitung secara adil secara proporsional ditambah info pembayaran (rekening/QRIS).

## Fitur Utama

- **AI Receipt Scanner:** Menggunakan Google Gemini API (`gemini-2.5-flash`) dengan Structured Output untuk membaca struk pembayaran Indonesia (mendukung subtotal, pajak, biaya layanan, dan total keseluruhan).
- **Proportional Bill Splitting:** Pajak dan biaya layanan dibagi secara proporsional sesuai dengan subtotal konsumsi masing-masing orang.
- **Rounding Reconciliation:** Pembulatan pecahan desimal ke Rupiah (integer) terdekat diselesaikan dengan metode sisa terbesar (*largest remainder*), memastikan jumlah seluruh porsi tepat sama persis dengan total tagihan struk.
- **Real-time Collaboration:** sinkronisasi otomatis menggunakan Supabase Realtime ketika ada menu yang dicentang oleh peserta.
- **Manual Back-up Entry:** Bila AI gagal membaca struk atau terjadi pembatasan kuota (*rate-limit*), host dapat memasukkan item menu secara manual.
- **No Login for Guests:** Menggunakan Supabase Anonymous Sign-in untuk mengidentifikasi sesi tamu dengan aman hanya bermodalkan nama tampilan.
- **Manual Payment Integration:** Menampilkan info nomor rekening bank host dan QRIS statis host untuk memudahkan transfer manual.
- **WhatsApp Text Generator:** Generate teks ringkasan patungan ramah dan sopan dalam bahasa Indonesia yang siap disalin ke WhatsApp.

---

## Prasyarat Setup

1. **Node.js:** Versi 20.9 atau yang lebih baru.
2. **Akun Supabase:** Proyek database PostgreSQL gratis dengan fitur Storage dan Realtime aktif.
3. **Google Gemini API Key:** API Key gratis untuk akses ke model `gemini-2.5-flash`.

---

## Cara Setup Supabase (Manual)

Silakan masuk ke Dashboard Supabase Anda dan lakukan konfigurasi berikut:

### 1. Jalankan Migrasi Database
Buka SQL Editor di Dashboard Supabase Anda, lalu salin dan jalankan seluruh isi file migrasi berikut:
[supabase/migrations/001_initial_schema.sql](file:///c:/BACKUP%20one%20drive/SAB%20Files/bagirata/supabase/migrations/001_initial_schema.sql)

Migrasi ini akan membuat tabel-tabel berikut:
- `rooms` (kamar patungan)
- `participants` (peserta kamar)
- `items` (item menu makanan)
- `assignments` (pilihan menu per orang)
- `scan_jobs` (status pembacaan AI struk)
- `gemini_calls` (log panggilan rate limit AI)

Serta mengaktifkan RLS (Row Level Security) dengan izin SELECT (baca) publik berbasis kemampuan (*capability-based*) via tautan berkode acak.

### 2. Buat Storage Buckets
Pergi ke menu **Storage** di Dashboard Supabase Anda dan buat 2 bucket **Private**:
1. `receipts` - Untuk menampung foto struk sementara sebelum dibaca oleh AI (file akan otomatis dihapus setelah AI berhasil membaca).
2. `qris` - Untuk menampung file gambar QRIS statis milik host.

### 3. Aktifkan Anonymous Sign-Ins
Pergi ke **Project Settings > Authentication**. Di bawah bagian **User Signups**, aktifkan toggle **Allow anonymous sign-ins** ke posisi **ON**.

---

## Konfigurasi Environment Variables

Salin file `.env.example` menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Isi nilai-nilai variabel di dalam `.env.local` sebagai berikut:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key # Sensitif! Hanya di server.

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key # Sensitif! Hanya di server.
GEMINI_MODEL=gemini-2.5-flash
GEMINI_RPM_LIMIT=10
GEMINI_RPD_LIMIT=250

# App Config
ROOM_EXPIRY_DAYS=30
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Menjalankan secara Lokal

1. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

2. **Jalankan Server Development:**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di [http://localhost:3000](http://localhost:3000).

3. **Jalankan Unit Test (Kalkulasi Split):**
   ```bash
   npm run test
   ```

---

## Deploy ke Vercel

1. Buat repositori baru di GitHub dan commit semua kode Anda (pastikan `.env.local` masuk ke `.gitignore`).
2. Masuk ke Dashboard Vercel, impor proyek BagiRata Anda.
3. Di bagian **Environment Variables** proyek Vercel Anda, masukkan semua variabel dari `.env.local`.
4. Jalankan deploy. Vercel akan mendeteksi framework Next.js secara otomatis dan membangun aplikasi Anda.
