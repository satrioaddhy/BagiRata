import { supabaseAdmin } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RoomClient from "./room-client";

interface PageProps {
  params: Promise<{ shortCode: string }>;
}

// Generate dynamic metadata for OG preview
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shortCode } = await params;

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("merchant_name, tax_amount, service_charge_amount")
    .eq("short_code", shortCode)
    .single();

  const merchantName = room?.merchant_name || "Patungan";
  const total = (room?.tax_amount || 0) + (room?.service_charge_amount || 0);

  return {
    title: `${merchantName} | BagiRata`,
    description: `Ayo patungan di ${merchantName}! Buka link ini untuk pilih menu kamu.`,
    openGraph: {
      title: `${merchantName} — BagiRata`,
      description: `Patungan di ${merchantName}. Pilih menu kamu dan lihat berapa yang harus kamu bayar.${total > 0 ? "" : ""}`,
      siteName: "BagiRata",
      type: "website",
    },
  };
}

export default async function RoomPage({ params }: PageProps) {
  const { shortCode } = await params;

  // Fetch room data server-side
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("short_code", shortCode)
    .single();

  if (!room) {
    notFound();
  }

  if (room.status === "expired") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center">
          <span className="text-5xl block mb-4">⏰</span>
          <h1 className="text-2xl font-bold mb-2">Room Sudah Kedaluwarsa</h1>
          <p className="text-muted-foreground">
            Room ini sudah tidak aktif lagi.
          </p>
        </div>
      </main>
    );
  }

  // Fetch initial data
  const [itemsRes, participantsRes, assignmentsRes] = await Promise.all([
    supabaseAdmin.from("items").select("*").eq("room_id", room.id),
    supabaseAdmin.from("participants").select("*").eq("room_id", room.id),
    supabaseAdmin
      .from("assignments")
      .select("*")
      .in(
        "item_id",
        (
          await supabaseAdmin
            .from("items")
            .select("id")
            .eq("room_id", room.id)
        ).data?.map((i) => i.id) ?? []
      ),
  ]);

  return (
    <RoomClient
      room={room}
      initialItems={itemsRes.data || []}
      initialParticipants={participantsRes.data || []}
      initialAssignments={assignmentsRes.data || []}
    />
  );
}
