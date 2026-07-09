import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/qris-upload
 * Upload a QRIS image to the private qris bucket.
 * Returns the storage path for reference.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Tidak ada gambar QRIS" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File harus berupa gambar" },
        { status: 400 }
      );
    }

    const fileName = `${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("qris")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("QRIS upload error:", uploadError);
      return NextResponse.json(
        { error: "Gagal mengunggah QRIS" },
        { status: 500 }
      );
    }

    return NextResponse.json({ path: fileName }, { status: 201 });
  } catch (err) {
    console.error("QRIS upload error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}
