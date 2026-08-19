-- Stage 10: production-readiness RBAC catalogue fix.
-- The Users and Branches admin modules referenced permission codes that did not
-- exist in the catalogue, so every role (including OWNER/ADMIN) was denied.
-- Add the missing codes and grant them to OWNER/ADMIN only. Non-admin roles must
-- never receive these (matching the updated seed rule).

-- 1. Insert the missing permission codes (idempotent).
INSERT INTO "Permission" ("id", "code", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.code, now(), now()
FROM (VALUES
  ('user.view'),
  ('user.create'),
  ('user.edit'),
  ('branch.view'),
  ('branch.create'),
  ('branch.edit')
) AS t(code)
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" p WHERE p.code = t.code
);

-- 2. Grant the new codes to OWNER and ADMIN only (idempotent).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('OWNER', 'ADMIN')
  AND p.code IN (
    'user.view', 'user.create', 'user.edit',
    'branch.view', 'branch.create', 'branch.edit'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
