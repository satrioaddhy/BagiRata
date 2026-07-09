import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateShortCode } from "@/lib/utils";
import type { CreateRoomPayload } from "@/lib/types";

/**
 * POST /api/rooms
 * Create a new room with items and the host as the first participant.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateRoomPayload = await request.json();

    // Validate required fields
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "Minimal satu item diperlukan" },
        { status: 400 }
      );
    }

    if (!body.host_name || body.host_name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nama host diperlukan" },
        { status: 400 }
      );
    }

    // Generate unique short code (retry on collision)
    let shortCode = generateShortCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabaseAdmin
        .from("rooms")
        .select("id")
        .eq("short_code", shortCode)
        .single();

      if (!existing) break;
      shortCode = generateShortCode();
      attempts++;
    }

    // Calculate expiry
    const expiryDays = parseInt(process.env.ROOM_EXPIRY_DAYS || "30", 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create the room
    const { data: room, error: roomError } = await supabaseAdmin
      .from("rooms")
      .insert({
        short_code: shortCode,
        merchant_name: body.merchant_name,
        tax_amount: body.tax_amount,
        service_charge_amount: body.service_charge_amount,
        bank_name: body.bank_name,
        account_name: body.account_name,
        account_number: body.account_number,
        qris_path: body.qris_path,
        status: "active",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (roomError || !room) {
      console.error("Room creation error:", roomError);
      return NextResponse.json(
        { error: "Gagal membuat room" },
        { status: 500 }
      );
    }

    // Bulk insert items
    const itemRows = body.items.map((item) => ({
      room_id: room.id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      source: item.source,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("items")
      .insert(itemRows);

    if (itemsError) {
      console.error("Items insertion error:", itemsError);
      // Clean up the room if items fail
      await supabaseAdmin.from("rooms").delete().eq("id", room.id);
      return NextResponse.json(
        { error: "Gagal menyimpan item" },
        { status: 500 }
      );
    }

    // Create host as first participant
    const { data: host, error: hostError } = await supabaseAdmin
      .from("participants")
      .insert({
        room_id: room.id,
        display_name: body.host_name.trim(),
      })
      .select()
      .single();

    if (hostError) {
      console.error("Host participant error:", hostError);
    }

    return NextResponse.json(
      {
        roomId: room.id,
        shortCode: room.short_code,
        hostId: host?.id,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create room error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
