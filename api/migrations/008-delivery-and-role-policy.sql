-- Local release only: apply through the normal migration process at a future deployment.
-- The owner requested MFA exclusively for administrator roles.
DELETE FROM user_mfa m USING users u WHERE m.user_id=u.id AND u.role NOT IN ('OWNER','MANAGER');
-- The linked login is the canonical identity for existing pupil records too.
UPDATE students s SET name=u.name FROM users u WHERE u.tenant_id=s.tenant_id AND u.id=s.user_id AND u.role='STUDENT' AND s.name IS DISTINCT FROM u.name;
ALTER TABLE outbox ADD COLUMN tenant_id uuid REFERENCES tenants(id),
 ADD COLUMN user_id uuid REFERENCES users(id),
 ADD COLUMN topic text NOT NULL DEFAULT 'account',
 ADD COLUMN resource_id uuid,
 ADD COLUMN error_code text NOT NULL DEFAULT '',
 ADD COLUMN last_error text NOT NULL DEFAULT '',
 ADD COLUMN delivery_ref text NOT NULL DEFAULT '',
 ADD COLUMN receipt_checked boolean NOT NULL DEFAULT false,
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX outbox_tenant_created ON outbox(tenant_id,created_at DESC);
CREATE INDEX outbox_receipts ON outbox(next_at) WHERE channel='push' AND state='sent' AND NOT receipt_checked;
-- Prevent new links of one login to multiple pupil records without deleting legacy data.
CREATE FUNCTION enforce_student_login_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.user_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 9147));
  IF EXISTS(SELECT 1 FROM students WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id AND id<>NEW.id) THEN
   RAISE EXCEPTION 'Ce compte élève est déjà associé à un dossier.' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER student_login_link BEFORE INSERT OR UPDATE OF user_id ON students FOR EACH ROW EXECUTE FUNCTION enforce_student_login_link();
