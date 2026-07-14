import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/assignments
 * Upsert or delete an assignment based on target quantity.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, participant_id, quantity } = body;

    if (!item_id || !participant_id) {
      return NextResponse.json(
        { error: "Item ID dan Participant ID diperlukan" },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || quantity < 0) {
      return NextResponse.json(
        { error: "Kuantitas harus berupa angka non-negatif" },
        { status: 400 }
      );
    }

    // 1. Fetch item to know total available quantity
    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("quantity")
      .eq("id", item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Item tidak ditemukan" },
        { status: 404 }
      );
    }

    // 2. Fetch all existing assignments for this item
    const { data: existingAssignments, error: assignmentsError } = await supabaseAdmin
      .from("assignments")
      .select("id, participant_id, assigned_quantity")
      .eq("item_id", item_id);

    if (assignmentsError) {
      console.error("Fetch assignments error:", assignmentsError);
      return NextResponse.json(
        { error: "Gagal mengambil data pilihan" },
        { status: 500 }
      );
    }

    // Calculate how many portions are claimed by other participants
    const totalOtherAssigned = existingAssignments
      .filter((a) => a.participant_id !== participant_id)
      .reduce((sum, a) => sum + (a.assigned_quantity || 1), 0);

    const totalNewAssigned = totalOtherAssigned + quantity;

    // Validate limit
    if (totalNewAssigned > item.quantity) {
      const maxAvailable = item.quantity - totalOtherAssigned;
      return NextResponse.json(
        { error: `Kuantitas melebihi batas porsi tersedia. Maksimal tersisa: ${maxAvailable} porsi.` },
        { status: 400 }
      );
    }

    // Find if the current participant already has an assignment for this item
    const myAssignment = existingAssignments.find((a) => a.participant_id === participant_id);

    if (quantity === 0) {
      if (myAssignment) {
        // Delete assignment
        const { error: deleteError } = await supabaseAdmin
          .from("assignments")
          .delete()
          .eq("id", myAssignment.id);

        if (deleteError) {
          console.error("Assignment delete error:", deleteError);
          return NextResponse.json(
            { error: "Gagal menghapus pilihan" },
            { status: 500 }
          );
        }
      }
      return NextResponse.json({ action: "removed" });
    } else {
      // quantity > 0
      if (myAssignment) {
        // Update existing assignment's assigned_quantity
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("assignments")
          .update({ assigned_quantity: quantity })
          .eq("id", myAssignment.id)
          .select()
          .single();

        if (updateError) {
          console.error("Assignment update error:", updateError);
          return NextResponse.json(
            { error: "Gagal memperbarui pilihan" },
            { status: 500 }
          );
        }

        return NextResponse.json({ action: "updated", assignment: updated });
      } else {
        // Insert new assignment
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("assignments")
          .insert({
            item_id,
            participant_id,
            assigned_quantity: quantity
          })
          .select()
          .single();

        if (insertError) {
          console.error("Assignment insert error:", insertError);
          return NextResponse.json(
            { error: "Gagal menyimpan pilihan" },
            { status: 500 }
          );
        }

        return NextResponse.json({ action: "added", assignment: inserted }, { status: 201 });
      }
    }
  } catch (err) {
    console.error("Assignment toggle error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
