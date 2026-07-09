import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/participants
 * Join a room as a new participant (guest).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room_id, display_name } = body;

    if (!room_id || !display_name || display_name.trim().length === 0) {
      return NextResponse.json(
        { error: "Room ID dan nama diperlukan" },
        { status: 400 }
      );
    }

    // Verify room exists and is active
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, status")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json(
        { error: "Room tidak ditemukan" },
        { status: 404 }
      );
    }

    if (room.status !== "active") {
      return NextResponse.json(
        { error: "Room sudah tidak aktif" },
        { status: 410 }
      );
    }

    // Create participant
    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .insert({
        room_id,
        display_name: display_name.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("Participant creation error:", error);
      return NextResponse.json(
        { error: "Gagal bergabung ke room" },
        { status: 500 }
      );
    }

    return NextResponse.json(participant, { status: 201 });
  } catch (err) {
    console.error("Join room error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
