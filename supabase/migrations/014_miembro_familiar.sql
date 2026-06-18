-- ============================================================
-- 014_miembro_familiar.sql
-- Rol miembro_familiar (ejecutar ALTER TYPE en transacción separada)
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'miembro_familiar';
