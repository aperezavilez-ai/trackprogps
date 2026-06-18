-- Backfill notification emails for existing companies (idempotent)
UPDATE companies c
SET settings = jsonb_set(
  COALESCE(c.settings, '{}'::jsonb),
  '{notification_email}',
  to_jsonb(c.email::text),
  true
)
WHERE c.email IS NOT NULL
  AND (c.settings->>'notification_email') IS NULL;

UPDATE companies c
SET settings = jsonb_set(
  COALESCE(c.settings, '{}'::jsonb),
  '{notification_email_secondary}',
  to_jsonb(u.email::text),
  true
)
FROM LATERAL (
  SELECT email
  FROM users
  WHERE company_id = c.id
    AND role IN ('admin_empresa', 'super_admin')
    AND is_active IS NOT FALSE
  ORDER BY created_at ASC
  LIMIT 1
) u
WHERE u.email IS NOT NULL
  AND lower(u.email) <> lower(COALESCE(c.settings->>'notification_email', c.email, ''))
  AND (c.settings->>'notification_email_secondary') IS NULL;
