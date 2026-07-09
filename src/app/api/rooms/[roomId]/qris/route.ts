import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

/**
 * GET /api/rooms/[roomId]/qris
 * Generate a short-lived signed URL for the QRIS image.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;

    // Fetch room to get qris_path
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("qris_path")
      .eq("id", roomId)
      .single();

    if (!room?.qris_path) {
      return NextResponse.json(
        { error: "QRIS tidak tersedia" },
        { status: 404 }
      );
    }

    // Create signed URL (valid for 60 seconds)
    const { data: signedUrl, error } = await supabaseAdmin.storage
      .from("qris")
      .createSignedUrl(room.qris_path, 60);

    if (error || !signedUrl) {
      console.error("Signed URL error:", error);
      return NextResponse.json(
        { error: "Gagal membuat URL QRIS" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch (err) {
    console.error("QRIS URL error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
