"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Item, Assignment, Participant } from "@/lib/types";

interface UseRealtimeRoomReturn {
  items: Item[];
  assignments: Assignment[];
  participants: Participant[];
  loading: boolean;
}

/**
 * Subscribe to real-time updates for a room's items, assignments, and participants.
 * Fetches initial data then keeps it in sync via Supabase Realtime.
 */
export function useRealtimeRoom(roomId: string | null): UseRealtimeRoomReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!roomId) return;

    const [itemsRes, assignmentsRes, participantsRes] = await Promise.all([
      supabase.from("items").select("*").eq("room_id", roomId),
      supabase
        .from("assignments")
        .select("*")
        .in(
          "item_id",
          (
            await supabase
              .from("items")
              .select("id")
              .eq("room_id", roomId)
          ).data?.map((i) => i.id) ?? []
        ),
      supabase.from("participants").select("*").eq("room_id", roomId),
    ]);

    if (itemsRes.data) setItems(itemsRes.data);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data);
    if (participantsRes.data) setParticipants(participantsRes.data);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    fetchAll();

    const channel = supabase
      .channel(`room-${roomId}`)
      // Items changes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          // Re-fetch all on any item change to keep assignments consistent
          fetchAll();
        }
      )
      // Assignments changes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
        },
        () => {
          fetchAll();
        }
      )
      // Participants changes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchAll]);

  return { items, assignments, participants, loading };
}
