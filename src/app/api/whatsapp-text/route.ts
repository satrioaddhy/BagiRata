import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { calculateSplit } from "@/lib/calculation/split";
import { formatRupiah } from "@/lib/utils";
import type { Item, Assignment, Participant, Room } from "@/lib/types";

/**
 * POST /api/whatsapp-text
 * Generate a formatted WhatsApp summary for the bill split.
 */
export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID diperlukan" },
        { status: 400 }
      );
    }

    // Fetch all room data
    const [roomRes, itemsRes, assignmentsRes, participantsRes] =
      await Promise.all([
        supabaseAdmin.from("rooms").select("*").eq("id", roomId).single(),
        supabaseAdmin.from("items").select("*").eq("room_id", roomId),
        supabaseAdmin
          .from("assignments")
          .select("*, items!inner(room_id)")
          .eq("items.room_id", roomId),
        supabaseAdmin
          .from("participants")
          .select("*")
          .eq("room_id", roomId),
      ]);

    const room = roomRes.data as Room | null;
    const items = (itemsRes.data as Item[]) || [];
    const participants = (participantsRes.data as Participant[]) || [];

    // Extract assignments from the joined query
    const assignments: Assignment[] = (assignmentsRes.data || []).map(
      (a: Record<string, unknown>) => ({
        id: a.id as string,
        item_id: a.item_id as string,
        participant_id: a.participant_id as string,
        assigned_quantity: (a.assigned_quantity as number) || 1,
      })
    );

    if (!room) {
      return NextResponse.json(
        { error: "Room tidak ditemukan" },
        { status: 404 }
      );
    }

    // Calculate split
    const result = calculateSplit(
      items,
      assignments,
      participants,
      room.tax_amount,
      room.service_charge_amount
    );

    // Generate WhatsApp text
    const merchantName = room.merchant_name || "restoran";
    const lines: string[] = [
      `Halo semuanya! 👋`,
      `Berikut rincian patungan kita di *${merchantName}*:`,
      ``,
    ];

    for (const split of result.splits) {
      lines.push(`• ${split.displayName}: *${formatRupiah(split.total)}*`);
    }

    lines.push(``);

    // Payment info
    if (room.bank_name || room.account_number) {
      lines.push(`Bisa transfer ke:`);
      if (room.bank_name && room.account_number && room.account_name) {
        lines.push(
          `🏦 ${room.bank_name} ${room.account_number} a.n. ${room.account_name}`
        );
      } else if (room.account_number) {
        lines.push(`🏦 ${room.account_number}`);
      }
    }

    if (room.qris_path) {
      lines.push(`atau scan QRIS di link ya 🙏`);
    }

    // Append unassigned items warning if any
    if (result.unassignedItems.length > 0) {
      lines.push(``);
      lines.push(`⚠️ *Catatan:* Masih ada ${result.unassignedItems.length} item menu yang belum diklaim.`);
    }

    lines.push(``);
    lines.push(`Makasih banyak! 🙏`);
    lines.push(`_Dibuat via BagiRata_`);

    const text = lines.join("\n");

    return NextResponse.json({ text });
  } catch (err) {
    console.error("WhatsApp text error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
