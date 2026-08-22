-- Migration 1: Add 'manager' to app_role enum
-- This must be in a separate migration because PostgreSQL requires committing
-- the new enum value before it can be used.

alter type public.app_role add value if not exists 'manager';