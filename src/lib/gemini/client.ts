import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase/server";

// Server-only Gemini client setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const RPM_LIMIT = parseInt(process.env.GEMINI_RPM_LIMIT || "10", 10);
const RPD_LIMIT = parseInt(process.env.GEMINI_RPD_LIMIT || "250", 10);

/**
 * Check if we're under the rate limit budget.
 * Returns { allowed, rpm, rpd } where rpm/rpd are current counts.
 */
export async function checkRateLimit(): Promise<{
  allowed: boolean;
  rpm: number;
  rpd: number;
}> {
  const now = new Date();

  // Count calls in the last 60 seconds
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const { count: rpm } = await supabaseAdmin
    .from("gemini_calls")
    .select("*", { count: "exact", head: true })
    .gte("called_at", oneMinuteAgo);

  // Count calls since midnight Pacific (UTC-7 / UTC-8 depending on DST)
  // Use a simple approach: midnight of today in Pacific time
  const pacificOffset = -7; // PDT; for PST use -8
  const midnightPacific = new Date(now);
  midnightPacific.setUTCHours(-pacificOffset, 0, 0, 0);
  if (midnightPacific > now) {
    // If midnight Pacific hasn't happened yet today in UTC, go back a day
    midnightPacific.setUTCDate(midnightPacific.getUTCDate() - 1);
  }

  const { count: rpd } = await supabaseAdmin
    .from("gemini_calls")
    .select("*", { count: "exact", head: true })
    .gte("called_at", midnightPacific.toISOString());

  const currentRpm = rpm ?? 0;
  const currentRpd = rpd ?? 0;

  return {
    allowed: currentRpm < RPM_LIMIT && currentRpd < RPD_LIMIT,
    rpm: currentRpm,
    rpd: currentRpd,
  };
}

/**
 * Record a Gemini API call for rate-limit tracking.
 */
export async function recordCall(): Promise<void> {
  await supabaseAdmin.from("gemini_calls").insert({});
}

/**
 * Receipt extraction response schema for Gemini structured output.
 */
const receiptSchema = {
  type: "OBJECT" as const,
  properties: {
    merchant_name: { type: "STRING" as const },
    items: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          name: { type: "STRING" as const },
          quantity: { type: "INTEGER" as const },
          unit_price: { type: "INTEGER" as const },
        },
        required: ["name", "quantity", "unit_price"],
      },
    },
    subtotal: { type: "INTEGER" as const },
    tax_amount: { type: "INTEGER" as const },
    service_charge_amount: { type: "INTEGER" as const },
    total: { type: "INTEGER" as const },
    confidence: {
      type: "STRING" as const,
      enum: ["high", "medium", "low"],
    },
  },
  required: [
    "items",
    "subtotal",
    "tax_amount",
    "service_charge_amount",
    "total",
    "confidence",
  ],
};

/**
 * System prompt for receipt reading.
 */
const RECEIPT_PROMPT = `Kamu adalah asisten AI yang ahli membaca struk/bon restoran Indonesia.

Tugas:
1. Baca gambar struk restoran yang diberikan.
2. Ekstrak setiap item menu beserta jumlah (quantity) dan harga per unitnya.
3. Ekstrak subtotal, pajak (biasanya berlabel PB1 atau PPN), biaya layanan (service charge), dan total keseluruhan.
4. Semua nilai uang harus dalam Rupiah (IDR) sebagai bilangan bulat (integer), TANPA desimal.
5. Jika ada item yang harganya merupakan total (quantity × unit_price), hitung unit_price dengan membagi total item tersebut dengan quantity-nya.
6. Jika suatu nilai tidak jelas atau tidak terbaca, buat estimasi konservatif dan turunkan confidence ke "medium" atau "low".
7. Jika struk tidak terbaca sama sekali atau bukan struk restoran, tetap berikan response dengan items kosong dan confidence "low".

Penting:
- unit_price adalah harga PER SATU unit, bukan total harga item.
- quantity adalah jumlah unit yang dipesan.
- Pastikan subtotal ≈ sum(quantity × unit_price) untuk semua item.
- Pastikan total ≈ subtotal + tax_amount + service_charge_amount.`;

/**
 * Extract receipt data from an image using Gemini.
 * Returns the parsed JSON result.
 */
export async function extractReceipt(
  imageBase64: string,
  mimeType: string
): Promise<Record<string, unknown>> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: RECEIPT_PROMPT },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: receiptSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return JSON.parse(text);
}
