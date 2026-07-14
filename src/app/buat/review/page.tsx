"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/utils";
import type { ScanResult, ScanResultItem } from "@/lib/types";

interface EditableItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  source: "scan" | "manual";
}

type Step = "items" | "payment";

export default function ReviewPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("items");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [merchantName, setMerchantName] = useState("");
  const [taxAmount, setTaxAmount] = useState(0);
  const [isAutoTax, setIsAutoTax] = useState(false);
  const [serviceChargeAmount, setServiceChargeAmount] = useState(0);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [hostName, setHostName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [qrisFile, setQrisFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load scan result or draft from sessionStorage
  useEffect(() => {
    const draft = sessionStorage.getItem("reviewDraft");
    if (draft) {
      try {
        const data = JSON.parse(draft);
        setItems(data.items || []);
        setMerchantName(data.merchantName || "");
        setTaxAmount(data.taxAmount || 0);
        setIsAutoTax(!!data.isAutoTax);
        setServiceChargeAmount(data.serviceChargeAmount || 0);
        setHostName(data.hostName || "");
        setBankName(data.bankName || "");
        setAccountName(data.accountName || "");
        setAccountNumber(data.accountNumber || "");
        setStep(data.step || "items");

        // Also load confidence if available
        const storedScan = sessionStorage.getItem("scanResult");
        if (storedScan) {
          try {
            const scan = JSON.parse(storedScan);
            setConfidence(scan.confidence || null);
          } catch {
            // Ignore
          }
        }
        setIsLoaded(true);
        return;
      } catch (err) {
        console.error("Failed to load reviewDraft:", err);
      }
    }

    const stored = sessionStorage.getItem("scanResult");
    if (stored) {
      try {
        const result: ScanResult = JSON.parse(stored);
        setMerchantName(result.merchant_name || "");
        setTaxAmount(result.tax_amount);
        setServiceChargeAmount(result.service_charge_amount);
        setConfidence(result.confidence);
        setItems(
          result.items.map((item: ScanResultItem, i: number) => ({
            id: `scan-${i}`,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            source: "scan" as const,
          }))
        );
      } catch (err) {
        // Invalid data, start fresh
      }
    }
    setIsLoaded(true);
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // Auto-calculate tax if enabled
  useEffect(() => {
    if (isAutoTax) {
      setTaxAmount(Math.round(subtotal * 0.11));
    }
  }, [isAutoTax, subtotal]);

  // Save draft to sessionStorage on state changes
  useEffect(() => {
    if (!isLoaded) return;
    const draftState = {
      items,
      merchantName,
      taxAmount,
      isAutoTax,
      serviceChargeAmount,
      hostName,
      bankName,
      accountName,
      accountNumber,
      step,
    };
    sessionStorage.setItem("reviewDraft", JSON.stringify(draftState));
  }, [
    isLoaded,
    items,
    merchantName,
    taxAmount,
    isAutoTax,
    serviceChargeAmount,
    hostName,
    bankName,
    accountName,
    accountNumber,
    step,
  ]);

  const grandTotal = subtotal + taxAmount + serviceChargeAmount;

  function addItem() {
    setItems([
      ...items,
      {
        id: `manual-${Date.now()}`,
        name: "",
        quantity: 1,
        unit_price: 0,
        source: "manual",
      },
    ]);
  }

  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof EditableItem, value: string | number) {
    setItems(
      items.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  async function handleSubmit() {
    // Validate
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu item");
      return;
    }
    if (!hostName.trim()) {
      toast.error("Masukkan nama kamu");
      return;
    }
    for (const item of items) {
      if (!item.name.trim()) {
        toast.error("Semua item harus punya nama");
        return;
      }
      if (item.unit_price <= 0) {
        toast.error(`Harga "${item.name}" harus lebih dari 0`);
        return;
      }
    }

    setSubmitting(true);

    try {
      // Upload QRIS if provided
      let qrisPath: string | null = null;
      if (qrisFile) {
        const qrisForm = new FormData();
        qrisForm.append("image", qrisFile);
        const qrisRes = await fetch("/api/qris-upload", {
          method: "POST",
          body: qrisForm,
        });
        if (qrisRes.ok) {
          const qrisData = await qrisRes.json();
          qrisPath = qrisData.path;
        }
      }

      // Create room
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_name: merchantName || null,
          tax_amount: taxAmount,
          service_charge_amount: serviceChargeAmount,
          bank_name: bankName || null,
          account_name: accountName || null,
          account_number: accountNumber || null,
          qris_path: qrisPath,
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity || 1,
            unit_price: i.unit_price,
            source: i.source,
          })),
          host_name: hostName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal membuat room");
      }

      const data = await res.json();

      // Store room info and navigate to share page
      sessionStorage.setItem("roomId", data.roomId);
      sessionStorage.setItem("shortCode", data.shortCode);
      sessionStorage.setItem("hostId", data.hostId);
      sessionStorage.setItem("merchantName", merchantName);

      // Clean up scan data
      sessionStorage.removeItem("scanResult");
      sessionStorage.removeItem("scanJobId");
      sessionStorage.removeItem("reviewDraft");

      router.push("/buat/share");
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat room"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleNextToPayment() {
    if (items.length === 0) {
      toast.error("Tambahkan minimal satu item");
      return;
    }
    for (const item of items) {
      if (!item.name.trim()) {
        toast.error("Semua item harus memiliki nama");
        return;
      }
      if (item.unit_price <= 0) {
        toast.error(`Harga "${item.name || 'item'}" harus lebih dari 0`);
        return;
      }
    }
    setStep("payment");
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="mb-6 animate-slide-up">
        <button
          onClick={() => {
            if (step === "payment") {
              setStep("items");
            } else {
              router.back();
            }
          }}
          className="text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-bold">
          {step === "items" ? "Review Item" : "Info Pembayaran"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === "items"
            ? "Periksa dan edit item dari struk"
            : "Masukkan info pembayaran untuk teman-teman"}
        </p>

        {/* Step indicator */}
        <div className="flex gap-2 mt-4">
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step === "items" ? "bg-primary" : "bg-primary/30"
            }`}
          />
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step === "payment" ? "bg-primary" : "bg-primary/30"
            }`}
          />
        </div>
      </div>

      {step === "items" && (
        <div className="flex-1 flex flex-col gap-4 animate-slide-up">
          {/* Confidence badge */}
          {confidence && (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  confidence === "high"
                    ? "default"
                    : confidence === "medium"
                      ? "secondary"
                      : "destructive"
                }
                className="rounded-full"
              >
                {confidence === "high"
                  ? "✅ Akurasi Tinggi"
                  : confidence === "medium"
                    ? "⚠️ Akurasi Sedang"
                    : "❌ Akurasi Rendah"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Periksa kembali hasilnya
              </span>
            </div>
          )}

          {/* Merchant name */}
          <div>
            <Label htmlFor="merchant" className="text-sm font-medium mb-1.5 block">
              Nama Restoran
            </Label>
            <Input
              id="merchant"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Contoh: Warung Makan Sederhana"
              className="rounded-xl h-11"
            />
          </div>

          {/* Items list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Item Menu</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addItem}
                className="text-primary hover:text-primary/80 text-sm"
              >
                + Tambah Item
              </Button>
            </div>

            {items.length === 0 && (
              <Card className="p-6 text-center border-dashed border-2 rounded-2xl">
                <p className="text-muted-foreground mb-3">
                  Belum ada item. Tambahkan item menu.
                </p>
                <Button onClick={addItem} variant="outline" className="rounded-xl">
                  + Tambah Item Pertama
                </Button>
              </Card>
            )}

            {items.map((item, index) => (
              <Card
                key={item.id}
                className="p-3 rounded-xl border-border/50 bg-card/50"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-2.5 w-5 text-right flex-shrink-0">
                    {index + 1}.
                  </span>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateItem(item.id, "name", e.target.value)
                      }
                      placeholder="Nama item"
                      className="rounded-lg h-9 text-sm"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">
                          Qty
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "quantity",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="rounded-lg h-9 text-sm"
                        />
                      </div>
                      <div className="flex-[2]">
                        <Label className="text-xs text-muted-foreground">
                          Harga/unit (Rp)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.unit_price === 0 ? "" : item.unit_price}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "unit_price",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="rounded-lg h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Total: {formatRupiah(item.unit_price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Separator className="my-2" />

          {/* Tax & Service Charge */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="tax" className="text-sm font-medium block">
                  Pajak (Rp)
                </Label>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="autoTax"
                    checked={isAutoTax}
                    onCheckedChange={(checked) => setIsAutoTax(!!checked)}
                  />
                  <Label htmlFor="autoTax" className="text-xs font-normal text-muted-foreground cursor-pointer select-none">
                    Pajak 11%
                  </Label>
                </div>
              </div>
              <Input
                id="tax"
                type="number"
                min={0}
                value={taxAmount === 0 ? "" : taxAmount}
                onChange={(e) => setTaxAmount(parseInt(e.target.value) || 0)}
                disabled={isAutoTax}
                className={`rounded-xl h-11 transition-all ${isAutoTax ? "bg-muted text-muted-foreground opacity-80" : ""}`}
              />
            </div>
            <div>
              <Label htmlFor="service" className="text-sm font-medium mb-1.5 block">
                Service (Rp)
              </Label>
              <Input
                id="service"
                type="number"
                min={0}
                value={serviceChargeAmount === 0 ? "" : serviceChargeAmount}
                onChange={(e) =>
                  setServiceChargeAmount(parseInt(e.target.value) || 0)
                }
                className="rounded-xl h-11"
              />
            </div>
          </div>

          {/* Totals */}
          <Card className="p-4 rounded-xl bg-primary/5 border-primary/20">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pajak</span>
                <span>{formatRupiah(taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span>{formatRupiah(serviceChargeAmount)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
            </div>
          </Card>

          <Button
            onClick={handleNextToPayment}
            disabled={items.length === 0}
            className="w-full h-12 rounded-xl font-semibold text-base mt-2"
          >
            Lanjut ke Pembayaran →
          </Button>
        </div>
      )}

      {step === "payment" && (
        <div className="flex-1 flex flex-col gap-4 animate-slide-up">
          {/* Host name */}
          <div>
            <Label htmlFor="hostName" className="text-sm font-medium mb-1.5 block">
              Nama Kamu (Pembuat Tagihan) *
            </Label>
            <Input
              id="hostName"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Nama kamu"
              className="rounded-xl h-11"
            />
          </div>

          <Separator className="my-1" />

          <p className="text-sm text-muted-foreground">
            Info pembayaran (opsional, tapi sangat disarankan)
          </p>

          {/* Bank info */}
          <div>
            <Label htmlFor="bankName" className="text-sm font-medium mb-1.5 block">
              Nama Bank
            </Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Contoh: BCA, Mandiri, GoPay"
              className="rounded-xl h-11"
            />
          </div>

          <div>
            <Label htmlFor="accountName" className="text-sm font-medium mb-1.5 block">
              Nama Pemilik Rekening
            </Label>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Nama di rekening"
              className="rounded-xl h-11"
            />
          </div>

          <div>
            <Label htmlFor="accountNumber" className="text-sm font-medium mb-1.5 block">
              Nomor Rekening
            </Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="1234567890"
              className="rounded-xl h-11"
            />
          </div>

          <Separator className="my-1" />

          {/* QRIS upload */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Gambar QRIS (Opsional)
            </Label>
            <Card
              className="p-4 border-dashed border-2 rounded-xl cursor-pointer
                         hover:border-primary/60 transition-colors text-center"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) setQrisFile(file);
                };
                input.click();
              }}
            >
              {qrisFile ? (
                <div className="flex items-center gap-2 justify-center">
                  <span className="text-primary">✅</span>
                  <span className="text-sm">{qrisFile.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrisFile(null);
                    }}
                    className="text-xs text-destructive ml-2"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-2xl block mb-1">📱</span>
                  <p className="text-sm text-muted-foreground">
                    Ketuk untuk unggah QRIS
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-auto pt-4">
            <Button
              onClick={handleSubmit}
              disabled={submitting || !hostName.trim()}
              className="w-full h-14 rounded-2xl font-bold text-lg animate-pulse-glow"
            >
              {submitting ? "Membuat Room..." : "🚀 Buat Room & Bagikan"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
