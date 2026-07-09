// ============================================================
// Shared TypeScript types for BagiRata
// ============================================================

/** A bill-splitting room */
export interface Room {
  id: string;
  short_code: string;
  merchant_name: string | null;
  tax_amount: number; // integer IDR
  service_charge_amount: number; // integer IDR
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qris_path: string | null;
  status: "active" | "expired";
  created_at: string;
  expires_at: string;
}

/** A participant in a room */
export interface Participant {
  id: string;
  room_id: string;
  display_name: string;
  joined_at: string;
}

/** A menu/bill item */
export interface Item {
  id: string;
  room_id: string;
  name: string;
  quantity: number;
  unit_price: number; // integer IDR per single unit
  source: "scan" | "manual";
}

/** Assignment linking a participant to an item */
export interface Assignment {
  id: string;
  item_id: string;
  participant_id: string;
}

/** Scan job status */
export type ScanJobStatus = "queued" | "processing" | "done" | "failed";

/** A receipt scanning job */
export interface ScanJob {
  id: string;
  status: ScanJobStatus;
  result: ScanResult | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** Result from Gemini receipt extraction */
export interface ScanResult {
  merchant_name?: string;
  items: ScanResultItem[];
  subtotal: number;
  tax_amount: number;
  service_charge_amount: number;
  total: number;
  confidence: "high" | "medium" | "low";
}

/** A single item extracted from a receipt */
export interface ScanResultItem {
  name: string;
  quantity: number;
  unit_price: number;
}

/** Per-person split result */
export interface PersonSplit {
  participantId: string;
  displayName: string;
  subtotal: number; // sum of item shares (integer IDR)
  tax: number; // proportional tax share (integer IDR, after rounding)
  serviceCharge: number; // proportional service charge share (integer IDR, after rounding)
  total: number; // final total (integer IDR)
}

/** Full split calculation result */
export interface SplitResult {
  splits: PersonSplit[];
  grandTotal: number;
  unassignedItems: string[]; // item IDs with no assignments
}

/** Data for creating a room */
export interface CreateRoomPayload {
  merchant_name: string | null;
  tax_amount: number;
  service_charge_amount: number;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qris_path: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    source: "scan" | "manual";
  }>;
  host_name: string;
}
