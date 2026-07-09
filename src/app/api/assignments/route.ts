import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/assignments
 * Toggle an assignment: create if it doesn't exist, or delete if it does.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, participant_id } = body;

    if (!item_id || !participant_id) {
      return NextResponse.json(
        { error: "Item ID dan Participant ID diperlukan" },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const { data: existing } = await supabaseAdmin
      .from("assignments")
      .select("id")
      .eq("item_id", item_id)
      .eq("participant_id", participant_id)
      .single();

    if (existing) {
      // Remove assignment (toggle off)
      const { error } = await supabaseAdmin
        .from("assignments")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error("Assignment delete error:", error);
        return NextResponse.json(
          { error: "Gagal menghapus pilihan" },
          { status: 500 }
        );
      }

      return NextResponse.json({ action: "removed" });
    } else {
      // Create assignment (toggle on)
      const { data: assignment, error } = await supabaseAdmin
        .from("assignments")
        .insert({ item_id, participant_id })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          // If it already exists, treat as a successful toggle on
          return NextResponse.json(
            { action: "added", message: "Sudah terdaftar" },
            { status: 200 }
          );
        }
        console.error("Assignment create error:", error);
        return NextResponse.json(
          { error: "Gagal menyimpan pilihan" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { action: "added", assignment },
        { status: 201 }
      );
    }
  } catch (err) {
    console.error("Assignment toggle error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
