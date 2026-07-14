-- ============================================================
-- Migration 002: Add assigned_quantity to assignments
-- ============================================================

-- Add the assigned_quantity column with a check constraint to prevent negative/zero portions.
alter table public.assignments
add column assigned_quantity integer not null default 1 check (assigned_quantity >= 1);
