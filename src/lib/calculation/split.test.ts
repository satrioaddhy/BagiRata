import { describe, it, expect } from "vitest";
import { calculateSplit } from "@/lib/calculation/split";
import type { Item, Assignment, Participant } from "@/lib/types";

// Helper to create test data
function makeItem(overrides: Partial<Item> & { id: string; name: string; unit_price: number }): Item {
  return {
    room_id: "room-1",
    quantity: 1,
    source: "manual",
    ...overrides,
  };
}

function makeParticipant(id: string, name: string): Participant {
  return { id, room_id: "room-1", display_name: name, joined_at: "" };
}

function makeAssignment(itemId: string, participantId: string): Assignment {
  return { id: `a-${itemId}-${participantId}`, item_id: itemId, participant_id: participantId };
}

describe("calculateSplit", () => {
  it("simple equal split — 2 people, 2 items, each person eats 1 item", () => {
    const items = [
      makeItem({ id: "i1", name: "Nasi Goreng", unit_price: 30000 }),
      makeItem({ id: "i2", name: "Mie Goreng", unit_price: 25000 }),
    ];
    const participants = [
      makeParticipant("p1", "Alice"),
      makeParticipant("p2", "Bob"),
    ];
    const assignments = [
      makeAssignment("i1", "p1"),
      makeAssignment("i2", "p2"),
    ];

    const result = calculateSplit(items, assignments, participants, 0, 0);

    expect(result.splits).toHaveLength(2);
    expect(result.splits.find((s) => s.participantId === "p1")?.total).toBe(30000);
    expect(result.splits.find((s) => s.participantId === "p2")?.total).toBe(25000);
    expect(result.grandTotal).toBe(55000);
    expect(result.unassignedItems).toHaveLength(0);
  });

  it("shared item — 1 item shared by 3 people with tax", () => {
    const items = [
      makeItem({ id: "i1", name: "Pizza", unit_price: 90000 }),
    ];
    const participants = [
      makeParticipant("p1", "Alice"),
      makeParticipant("p2", "Bob"),
      makeParticipant("p3", "Charlie"),
    ];
    const assignments = [
      makeAssignment("i1", "p1"),
      makeAssignment("i1", "p2"),
      makeAssignment("i1", "p3"),
    ];

    const result = calculateSplit(items, assignments, participants, 9000, 0);

    // Each should pay 30000 (item) + 3000 (tax) = 33000
    expect(result.grandTotal).toBe(99000);
    for (const split of result.splits) {
      expect(split.total).toBe(33000);
    }
    // Sum must equal grand total
    const totalPaid = result.splits.reduce((s, p) => s + p.total, 0);
    expect(totalPaid).toBe(result.grandTotal);
  });

  it("rounding reconciliation — fractional amounts round correctly", () => {
    // 100 IDR split among 3 people = 33.33... each
    // With tax of 10 IDR, total = 110
    // Each raw = 36.666... → floor = 36, sum = 108, remainder = 2
    // Two people get +1 each
    const items = [
      makeItem({ id: "i1", name: "Teh", unit_price: 100 }),
    ];
    const participants = [
      makeParticipant("p1", "A"),
      makeParticipant("p2", "B"),
      makeParticipant("p3", "C"),
    ];
    const assignments = [
      makeAssignment("i1", "p1"),
      makeAssignment("i1", "p2"),
      makeAssignment("i1", "p3"),
    ];

    const result = calculateSplit(items, assignments, participants, 10, 0);

    expect(result.grandTotal).toBe(110);
    // Sum of all totals MUST equal grand total exactly
    const totalPaid = result.splits.reduce((s, p) => s + p.total, 0);
    expect(totalPaid).toBe(110);
    // Each person should pay either 36 or 37
    for (const split of result.splits) {
      expect(split.total).toBeGreaterThanOrEqual(36);
      expect(split.total).toBeLessThanOrEqual(37);
    }
  });

  it("unassigned item is flagged", () => {
    const items = [
      makeItem({ id: "i1", name: "Nasi", unit_price: 20000 }),
      makeItem({ id: "i2", name: "Ayam", unit_price: 30000 }),
    ];
    const participants = [makeParticipant("p1", "Alice")];
    const assignments = [makeAssignment("i1", "p1")]; // i2 is unassigned

    const result = calculateSplit(items, assignments, participants, 0, 0);

    expect(result.unassignedItems).toContain("i2");
    expect(result.unassignedItems).not.toContain("i1");
  });

  it("single person assigned to everything", () => {
    const items = [
      makeItem({ id: "i1", name: "Nasi Goreng", unit_price: 30000 }),
      makeItem({ id: "i2", name: "Es Teh", unit_price: 8000, quantity: 2 }),
    ];
    const participants = [makeParticipant("p1", "Solo")];
    const assignments = [
      makeAssignment("i1", "p1"),
      makeAssignment("i2", "p1"),
    ];

    const result = calculateSplit(items, assignments, participants, 5000, 3000);

    // Subtotal = 30000 + 16000 = 46000, Tax = 5000, Service = 3000
    expect(result.grandTotal).toBe(54000);
    expect(result.splits[0].total).toBe(54000);
  });

  it("proportional tax split with unequal consumption", () => {
    const items = [
      makeItem({ id: "i1", name: "Steak", unit_price: 100000 }),
      makeItem({ id: "i2", name: "Salad", unit_price: 25000 }),
    ];
    const participants = [
      makeParticipant("p1", "Big Eater"),
      makeParticipant("p2", "Light Eater"),
    ];
    const assignments = [
      makeAssignment("i1", "p1"), // p1 eats the steak
      makeAssignment("i2", "p2"), // p2 eats the salad
    ];

    const result = calculateSplit(items, assignments, participants, 12500, 0);

    // p1 subtotal: 100000, p2 subtotal: 25000, total subtotal: 125000
    // p1 tax: 12500 * (100000/125000) = 10000
    // p2 tax: 12500 * (25000/125000) = 2500
    // p1 total: 110000, p2 total: 27500
    expect(result.grandTotal).toBe(137500);
    const p1 = result.splits.find((s) => s.participantId === "p1")!;
    const p2 = result.splits.find((s) => s.participantId === "p2")!;
    expect(p1.total).toBe(110000);
    expect(p2.total).toBe(27500);
    expect(p1.total + p2.total).toBe(result.grandTotal);
  });

  it("item with quantity > 1", () => {
    const items = [
      makeItem({ id: "i1", name: "Sate", unit_price: 5000, quantity: 10 }),
    ];
    const participants = [
      makeParticipant("p1", "A"),
      makeParticipant("p2", "B"),
    ];
    const assignments = [
      makeAssignment("i1", "p1"),
      makeAssignment("i1", "p2"),
    ];

    const result = calculateSplit(items, assignments, participants, 0, 0);

    // 50000 split by 2 = 25000 each
    expect(result.splits[0].total).toBe(25000);
    expect(result.splits[1].total).toBe(25000);
  });
});
