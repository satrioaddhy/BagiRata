import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  checkRateLimit,
  recordCall,
  extractReceipt,
} from "@/lib/gemini/client";
import { delay, backoffWithJitter } from "@/lib/utils";
import type { ScanResult } from "@/lib/types";

const MAX_RETRIES = 3;

/**
 * POST /api/scan
 * Receives a receipt image, creates a scan job, and processes it asynchronously.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Tidak ada gambar yang diunggah" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File harus berupa gambar" },
        { status: 400 }
      );
    }

    // Upload to receipts bucket
    const fileName = `${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("receipts")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Gagal mengunggah gambar" },
        { status: 500 }
      );
    }

    // Create scan job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("scan_jobs")
      .insert({ status: "queued" })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Job creation error:", jobError);
      return NextResponse.json(
        { error: "Gagal membuat tugas pemindaian" },
        { status: 500 }
      );
    }

    // Process asynchronously using next/server's after()
    // This keeps the serverless function alive after sending the response.
    const imageBase64 = buffer.toString("base64");
    const mimeType = file.type;
    const jobId = job.id;

    after(async () => {
      await processReceipt(jobId, imageBase64, mimeType, fileName);
    });

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (err) {
    console.error("Scan endpoint error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal" },
      { status: 500 }
    );
  }
}

/**
 * Process the receipt extraction asynchronously.
 * Handles rate limiting, retries, and cleanup.
 */
async function processReceipt(
  jobId: string,
  imageBase64: string,
  mimeType: string,
  fileName: string
) {
  try {
    // Update job to processing
    await supabaseAdmin
      .from("scan_jobs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Check rate limits
      const { allowed } = await checkRateLimit();

      if (!allowed) {
        if (attempt < MAX_RETRIES - 1) {
          const waitMs = backoffWithJitter(attempt);
          console.log(
            `Rate limit hit, waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await delay(waitMs);
          continue;
        } else {
          lastError = new Error("Kuota AI harian telah habis. Silakan coba lagi besok atau masukkan item secara manual.");
          break;
        }
      }

      try {
        // Record the call before making it
        await recordCall();

        // Call Gemini
        const result = await extractReceipt(imageBase64, mimeType);

        // Validate the result
        const validationError = validateScanResult(result);
        if (validationError) {
          lastError = new Error(validationError);
          // Don't retry on validation errors — the image may be bad
          break;
        }

        // Success! Update job
        await supabaseAdmin
          .from("scan_jobs")
          .update({
            status: "done",
            result,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        // Delete the receipt image (privacy + storage hygiene)
        await supabaseAdmin.storage.from("receipts").remove([fileName]);

        return; // Done!
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        lastError = error;

        // If it's a 429 rate limit from Gemini, retry with backoff
        if (error.status === 429 || error.message?.includes("429")) {
          if (attempt < MAX_RETRIES - 1) {
            const waitMs = backoffWithJitter(attempt);
            console.log(
              `Gemini 429, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
            );
            await delay(waitMs);
            continue;
          }
        } else {
          // Non-rate-limit error — don't retry
          break;
        }
      }
    }

    // All retries exhausted or non-retryable error
    const errorMessage =
      lastError?.message ||
      "Tidak dapat membaca struk. Silakan masukkan item secara manual.";

    await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "failed",
        error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // Still clean up the image on failure
    await supabaseAdmin.storage.from("receipts").remove([fileName]);
  } catch (err) {
    console.error("processReceipt fatal error:", err);

    await supabaseAdmin
      .from("scan_jobs")
      .update({
        status: "failed",
        error: "Terjadi kesalahan saat memproses struk. Silakan masukkan item secara manual.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

/**
 * Validate the scan result JSON.
 * Returns an error message if invalid, null if OK.
 */
function validateScanResult(result: Record<string, unknown>): string | null {
  const scanResult = result as unknown as ScanResult;

  if (!scanResult.items || !Array.isArray(scanResult.items)) {
    return "Hasil pemindaian tidak mengandung item menu.";
  }

  if (scanResult.items.length === 0) {
    return "Tidak ada item menu yang terdeteksi pada struk.";
  }

  // Check all items have valid data
  for (const item of scanResult.items) {
    if (!item.name || typeof item.quantity !== "number" || typeof item.unit_price !== "number") {
      return "Data item menu tidak lengkap.";
    }
    if (item.quantity <= 0 || item.unit_price < 0) {
      return "Jumlah atau harga item tidak valid.";
    }
  }

  if (typeof scanResult.total !== "number" || scanResult.total <= 0) {
    return "Total tagihan tidak terdeteksi.";
  }

  return null;
}
