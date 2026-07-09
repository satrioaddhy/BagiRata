"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAnonymousAuth } from "@/hooks/use-anonymous-auth";
import { useRealtimeRoom } from "@/hooks/use-realtime-room";
import { calculateSplit } from "@/lib/calculation/split";
import { formatRupiah } from "@/lib/utils";
import type {
  Room,
  Item,
  Participant,
  Assignment,
} from "@/lib/types";

interface RoomClientProps {
  room: Room;
  initialItems: Item[];
  initialParticipants: Participant[];
  initialAssignments: Assignment[];
}

export default function RoomClient({
  room,
  initialItems,
  initialParticipants,
  initialAssignments,
}: RoomClientProps) {
  const { user, loading: authLoading } = useAnonymousAuth();
  const {
    items: realtimeItems,
    assignments: realtimeAssignments,
    participants: realtimeParticipants,
    loading: realtimeLoading,
  } = useRealtimeRoom(room.id);

  // Use realtime data if available, fallback to initial
  const items = realtimeLoading ? initialItems : realtimeItems;
  const assignments = realtimeLoading ? initialAssignments : realtimeAssignments;
  const participants = realtimeLoading
    ? initialParticipants
    : realtimeParticipants;

  const [displayName, setDisplayName] = useState("");
  const [joined, setJoined] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set());
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Check if current user already joined (by checking sessionStorage)
  useEffect(() => {
    const storedParticipantId = sessionStorage.getItem(
      `participant_${room.id}`
    );
    if (storedParticipantId) {
      setParticipantId(storedParticipantId);
      setJoined(true);
    }
  }, [room.id]);

  // Calculate split
  const splitResult = useMemo(() => {
    if (items.length === 0 || participants.length === 0) return null;
    return calculateSplit(
      items,
      assignments,
      participants,
      room.tax_amount,
      room.service_charge_amount
    );
  }, [items, assignments, participants, room.tax_amount, room.service_charge_amount]);

  // Fetch QRIS signed URL
  useEffect(() => {
    if (room.qris_path && showPayment) {
      fetch(`/api/rooms/${room.id}/qris`)
        .then((r) => r.json())
        .then((data) => {
          if (data.url) setQrisUrl(data.url);
        })
        .catch(console.error);
    }
  }, [room.id, room.qris_path, showPayment]);

  async function handleJoin() {
    if (!displayName.trim()) {
      toast.error("Masukkan nama kamu dulu ya");
      return;
    }

    setJoiningRoom(true);
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: room.id,
          display_name: displayName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      const participant = await res.json();
      setParticipantId(participant.id);
      setJoined(true);
      sessionStorage.setItem(`participant_${room.id}`, participant.id);
      toast.success(`Selamat datang, ${displayName.trim()}! 🎉`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal bergabung"
      );
    } finally {
      setJoiningRoom(false);
    }
  }

  async function toggleAssignment(itemId: string) {
    if (!participantId) return;

    setTogglingItems((prev) => new Set(prev).add(itemId));

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          participant_id: participantId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal update pilihan"
      );
    } finally {
      setTogglingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function copyAccountNumber() {
    if (room.account_number) {
      try {
        await navigator.clipboard.writeText(room.account_number);
        toast.success("Nomor rekening berhasil disalin! 📋");
      } catch {
        toast.error("Gagal menyalin nomor rekening");
      }
    }
  }

  async function generateWhatsAppText() {
    try {
      const res = await fetch("/api/whatsapp-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });

      if (!res.ok) throw new Error("Gagal generate teks");

      const { text } = await res.json();
      await navigator.clipboard.writeText(text);
      toast.success("Ringkasan WhatsApp berhasil disalin! 💬");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat ringkasan"
      );
    }
  }

  // Check which items current participant has selected
  function isItemSelected(itemId: string): boolean {
    if (!participantId) return false;
    return assignments.some(
      (a) => a.item_id === itemId && a.participant_id === participantId
    );
  }

  // Count how many people share an item
  function getAssignmentCount(itemId: string): number {
    return assignments.filter((a) => a.item_id === itemId).length;
  }

  // Get assignee names for an item
  function getAssigneeNames(itemId: string): string[] {
    const itemAssignments = assignments.filter((a) => a.item_id === itemId);
    return itemAssignments
      .map((a) => participants.find((p) => p.id === a.participant_id)?.display_name)
      .filter(Boolean) as string[];
  }

  if (authLoading) {
    return (
      <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-40 w-full rounded-2xl mb-4" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </main>
    );
  }

  // Join form for new guests
  if (!joined) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-lg mx-auto w-full">
        <div className="w-full text-center animate-slide-up">
          <div className="w-20 h-20 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-6 mx-auto">
            <span className="text-4xl">🍽️</span>
          </div>

          <h1 className="text-2xl font-bold mb-1">
            {room.merchant_name || "Patungan"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {participants.length} orang sudah bergabung
          </p>

          <div className="space-y-4 max-w-xs mx-auto">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Masukkan nama kamu"
              className="rounded-xl h-12 text-center text-lg"
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />

            <Button
              onClick={handleJoin}
              disabled={joiningRoom || !displayName.trim()}
              className="w-full h-14 rounded-2xl font-bold text-lg animate-pulse-glow"
            >
              {joiningRoom ? "Bergabung..." : "🙋 Gabung Patungan"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Main room view
  const mySplit = splitResult?.splits.find(
    (s) => s.participantId === participantId
  );
  const hasUnassigned = (splitResult?.unassignedItems.length ?? 0) > 0;

  return (
    <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full pb-32">
      {/* Header */}
      <div className="mb-4 animate-slide-up">
        <h1 className="text-xl font-bold">
          {room.merchant_name || "Patungan"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {participants.length} orang bergabung
        </p>
      </div>

      {/* Participants bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
        {participants.map((p) => (
          <Badge
            key={p.id}
            variant={p.id === participantId ? "default" : "secondary"}
            className="rounded-full px-3 py-1 flex-shrink-0 text-xs"
          >
            {p.id === participantId ? "👤 " : ""}
            {p.display_name}
          </Badge>
        ))}
      </div>

      {/* Unassigned warning */}
      {hasUnassigned && (
        <Card className="p-3 rounded-xl border-accent/50 bg-accent/10 mb-4">
          <p className="text-sm text-accent-foreground">
            ⚠️ Ada {splitResult!.unassignedItems.length} item yang belum
            dipilih siapa pun
          </p>
        </Card>
      )}

      {/* Menu items */}
      <div className="space-y-2 mb-6 stagger-children">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Menu
        </h2>
        {items.map((item) => {
          const selected = isItemSelected(item.id);
          const count = getAssignmentCount(item.id);
          const names = getAssigneeNames(item.id);
          const toggling = togglingItems.has(item.id);
          const isUnassigned = splitResult?.unassignedItems.includes(item.id);

          return (
            <Card
              key={item.id}
              className={`p-3 rounded-xl transition-all duration-200 cursor-pointer
                         ${selected ? "border-primary/50 bg-primary/5" : "border-border/50"}
                         ${isUnassigned ? "border-accent/50" : ""}
                         ${toggling ? "opacity-60" : ""}
                         active:scale-[0.98]`}
              onClick={() => !toggling && toggleAssignment(item.id)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected}
                  disabled={toggling}
                  className="mt-1 pointer-events-none"
                  onCheckedChange={() => {}}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.name}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x {formatRupiah(item.unit_price)}
                        </p>
                      )}
                    </div>
                    <p className="font-semibold text-sm flex-shrink-0">
                      {formatRupiah(item.unit_price * item.quantity)}
                    </p>
                  </div>

                  {/* Show who selected this item */}
                  {count > 0 && (
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {count > 1 ? `${count} orang:` : ""}
                      </span>
                      {names.map((name) => (
                        <Badge
                          key={name}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 rounded-full"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Separator className="my-4" />

      {/* Split Summary */}
      {splitResult && splitResult.splits.length > 0 && (
        <div className="space-y-3 mb-6 animate-slide-up">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Rincian Pembagian
          </h2>

          {splitResult.splits.map((split) => (
            <Card
              key={split.participantId}
              className={`p-3 rounded-xl ${
                split.participantId === participantId
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/30"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">
                    {split.participantId === participantId
                      ? `👤 ${split.displayName} (Kamu)`
                      : split.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Menu: {formatRupiah(split.subtotal)} + Pajak:{" "}
                    {formatRupiah(split.tax)} + Service:{" "}
                    {formatRupiah(split.serviceCharge)}
                  </p>
                </div>
                <p
                  className={`font-bold text-base ${
                    split.participantId === participantId
                      ? "text-primary"
                      : ""
                  }`}
                >
                  {formatRupiah(split.total)}
                </p>
              </div>
            </Card>
          ))}

          <Card className="p-3 rounded-xl bg-primary/10 border-primary/30">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm">Total Tagihan</span>
              <span className="font-bold text-lg text-primary">
                {formatRupiah(splitResult.grandTotal)}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Payment & Actions - Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border/50 p-4 z-50">
        <div className="max-w-lg mx-auto">
          {mySplit && mySplit.total > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Kamu harus bayar:
              </span>
              <span className="font-bold text-xl text-primary">
                {formatRupiah(mySplit.total)}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            {(room.bank_name || room.qris_path) && (
              <Button
                onClick={() => setShowPayment(!showPayment)}
                variant="outline"
                className="flex-1 h-12 rounded-xl font-semibold"
              >
                💳 Info Bayar
              </Button>
            )}
            <Button
              onClick={generateWhatsAppText}
              className="flex-1 h-12 rounded-xl font-semibold"
            >
              💬 Salin Ringkasan
            </Button>
          </div>
        </div>
      </div>

      {/* Payment modal/sheet */}
      {showPayment && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPayment(false)}
          />
          <div className="relative bg-background rounded-t-3xl p-6 w-full max-w-lg animate-slide-up">
            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold mb-4">Info Pembayaran</h3>

            {room.bank_name && (
              <div className="space-y-2 mb-4">
                <p className="text-sm text-muted-foreground">Transfer ke:</p>
                <Card className="p-4 rounded-xl">
                  <p className="font-semibold">{room.bank_name}</p>
                  <p className="text-lg font-mono mt-1">
                    {room.account_number}
                  </p>
                  {room.account_name && (
                    <p className="text-sm text-muted-foreground">
                      a.n. {room.account_name}
                    </p>
                  )}
                </Card>
                <Button
                  onClick={copyAccountNumber}
                  variant="outline"
                  className="w-full h-11 rounded-xl"
                >
                  📋 Salin Nomor Rekening
                </Button>
              </div>
            )}

            {qrisUrl && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Atau scan QRIS:
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrisUrl}
                  alt="QRIS"
                  className="w-full max-w-[250px] mx-auto rounded-xl border border-border"
                />
              </div>
            )}

            <Button
              onClick={() => setShowPayment(false)}
              variant="ghost"
              className="w-full mt-4"
            >
              Tutup
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
