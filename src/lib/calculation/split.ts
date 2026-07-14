import type { Item, Assignment, Participant, PersonSplit, SplitResult } from "@/lib/types";

/**
 * Calculate the fair split of a bill among participants.
 *
 * Algorithm:
 * 1. For each item, split its line total equally among assigned participants.
 * 2. Accumulate per-person subtotals.
 * 3. Split tax and service charge proportionally by each person's subtotal.
 * 4. Round down to whole rupiah, then distribute the remainder using the
 *    largest-remainder method to ensure the sum equals the grand total exactly.
 *
 * @param items - All items in the room
 * @param assignments - All assignments linking items to participants
 * @param participants - All participants in the room
 * @param taxAmount - Total tax in integer IDR
 * @param serviceChargeAmount - Total service charge in integer IDR
 * @returns SplitResult with per-person breakdown and unassigned item flags
 */
export function calculateSplit(
  items: Item[],
  assignments: Assignment[],
  participants: Participant[],
  taxAmount: number,
  serviceChargeAmount: number
): SplitResult {
  // Track unassigned items
  const unassignedItems: string[] = [];

  // Build assignment lookup: itemId → Array<{ participantId: string, quantity: number }>
  const itemAssignments = new Map<string, Array<{ participantId: string; quantity: number }>>();
  for (const a of assignments) {
    const existing = itemAssignments.get(a.item_id) || [];
    existing.push({
      participantId: a.participant_id,
      quantity: a.assigned_quantity || 1, // Fallback for older database rows
    });
    itemAssignments.set(a.item_id, existing);
  }

  // Initialize per-person subtotals
  const personSubtotals = new Map<string, number>();
  for (const p of participants) {
    personSubtotals.set(p.id, 0);
  }

  // Step 1 & 2: Calculate each participant's portion cost for items
  for (const item of items) {
    const assignedList = itemAssignments.get(item.id);
    if (!assignedList || assignedList.length === 0) {
      unassignedItems.push(item.id);
      continue;
    }

    // Check if the item is not fully claimed (sum of portions < item.quantity)
    const totalClaimedQty = assignedList.reduce((sum, a) => sum + a.quantity, 0);
    if (totalClaimedQty < item.quantity) {
      unassignedItems.push(item.id);
    }

    for (const assign of assignedList) {
      const portionCost = assign.quantity * item.unit_price;
      const current = personSubtotals.get(assign.participantId) ?? 0;
      personSubtotals.set(assign.participantId, current + portionCost);
    }
  }

  // Step 3: Calculate total subtotal for proportional split
  let totalSubtotal = 0;
  for (const sub of personSubtotals.values()) {
    totalSubtotal += sub;
  }

  // If nobody has any items, return zero splits
  if (totalSubtotal === 0) {
    return {
      splits: participants.map((p) => ({
        participantId: p.id,
        displayName: p.display_name,
        subtotal: 0,
        tax: 0,
        serviceCharge: 0,
        total: 0,
      })),
      grandTotal: 0,
      unassignedItems,
    };
  }

  // Calculate raw totals with fractional parts
  const rawSplits: Array<{
    participantId: string;
    displayName: string;
    subtotal: number;
    rawTax: number;
    rawServiceCharge: number;
    rawTotal: number;
  }> = [];

  for (const p of participants) {
    const subtotal = personSubtotals.get(p.id) ?? 0;
    const proportion = subtotal / totalSubtotal;
    const rawTax = taxAmount * proportion;
    const rawServiceCharge = serviceChargeAmount * proportion;
    const rawTotal = subtotal + rawTax + rawServiceCharge;

    rawSplits.push({
      participantId: p.id,
      displayName: p.display_name,
      subtotal,
      rawTax,
      rawServiceCharge,
      rawTotal,
    });
  }

  // Step 4: Rounding reconciliation using largest-remainder method
  const grandTotal = Math.round(totalSubtotal) + taxAmount + serviceChargeAmount;

  // Floor each total and track fractional remainders
  const flooredSplits = rawSplits.map((s) => {
    const floored = Math.floor(s.rawTotal);
    const remainder = s.rawTotal - floored;
    return { ...s, floored, remainder };
  });

  // Sum of floored totals
  const flooredSum = flooredSplits.reduce((sum, s) => sum + s.floored, 0);
  let leftover = grandTotal - flooredSum;

  // Sort by largest remainder (descending) and distribute leftover
  const sortedByRemainder = [...flooredSplits].sort(
    (a, b) => b.remainder - a.remainder
  );

  const finalTotals = new Map<string, number>();
  for (const s of flooredSplits) {
    finalTotals.set(s.participantId, s.floored);
  }

  for (const s of sortedByRemainder) {
    if (leftover <= 0) break;
    finalTotals.set(s.participantId, (finalTotals.get(s.participantId) ?? 0) + 1);
    leftover--;
  }

  // Build final result
  const splits: PersonSplit[] = rawSplits.map((s) => ({
    participantId: s.participantId,
    displayName: s.displayName,
    subtotal: Math.round(s.subtotal),
    tax: Math.round(s.rawTax),
    serviceCharge: Math.round(s.rawServiceCharge),
    total: finalTotals.get(s.participantId) ?? 0,
  }));

  return {
    splits,
    grandTotal,
    unassignedItems,
  };
}
