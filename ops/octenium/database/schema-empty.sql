-- EduBest: schema only, no users, students or payments.
-- Run once on a NEW EMPTY dedicated database. NEVER on another application's database.
BEGIN;
DO $$ BEGIN
 IF current_database() = 'edubest_test' THEN
  IF current_setting('edubest.allow_test_database', true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Explicit test database activation required'; END IF;
 ELSIF current_database() !~ '^([a-z][a-z0-9]{0,15}_)?edubest(_production)?$' OR current_database() ~* 'midad' THEN
  RAISE EXCEPTION 'Dedicated EduBest database required';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f','S')) THEN
  RAISE EXCEPTION 'Database is not empty: installation refused';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());

-- Migration: 001.sql
CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tenants(id uuid PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL, phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', locale text NOT NULL DEFAULT 'fr', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, email text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('OWNER','MANAGER','CASHIER','TEACHER','PARENT','STUDENT')), locale text NOT NULL DEFAULT 'fr', verified boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,email), UNIQUE(tenant_id,id));
CREATE TABLE auth_sessions(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE auth_tokens(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('verify','reset','invite')), expires_at timestamptz NOT NULL);
CREATE TABLE students(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, phone text NOT NULL DEFAULT '', level text NOT NULL DEFAULT '', birth_date date, parent_id uuid, user_id uuid, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,parent_id) REFERENCES users(tenant_id,id), FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id));
CREATE TABLE groups(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, subject text NOT NULL, level text NOT NULL DEFAULT '', teacher_id uuid, room text NOT NULL DEFAULT '', capacity integer NOT NULL CHECK(capacity>0), fee_centimes bigint NOT NULL CHECK(fee_centimes>=0), pay_mode text NOT NULL DEFAULT 'session' CHECK(pay_mode IN('session','hour','percent')), pay_value bigint NOT NULL DEFAULT 0 CHECK(pay_value>=0 AND (pay_mode!='percent' OR pay_value<=10000)), active boolean NOT NULL DEFAULT true, UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,teacher_id) REFERENCES users(tenant_id,id));
CREATE TABLE enrollments(tenant_id uuid NOT NULL, group_id uuid NOT NULL, student_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,group_id,student_id), FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id), FOREIGN KEY(tenant_id,student_id) REFERENCES students(tenant_id,id));
CREATE TABLE lessons(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), group_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at), room text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','completed','cancelled')), UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id));
CREATE INDEX lessons_schedule ON lessons(tenant_id,starts_at);
CREATE TABLE attendance(tenant_id uuid NOT NULL, lesson_id uuid NOT NULL, student_id uuid NOT NULL, status text NOT NULL CHECK(status IN('present','absent','late','unmarked')), updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(), justification text NOT NULL DEFAULT '', decision text NOT NULL DEFAULT 'pending' CHECK(decision IN('pending','accepted','rejected')), PRIMARY KEY(tenant_id,lesson_id,student_id), FOREIGN KEY(tenant_id,lesson_id) REFERENCES lessons(tenant_id,id), FOREIGN KEY(tenant_id,student_id) REFERENCES students(tenant_id,id));
CREATE TABLE invoices(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), student_id uuid NOT NULL, group_id uuid, label text NOT NULL, amount_centimes bigint NOT NULL CHECK(amount_centimes>0), due_date date NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN('open','cancelled')), billing_period text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,student_id) REFERENCES students(tenant_id,id), FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id));
CREATE UNIQUE INDEX invoices_billing_unique ON invoices(tenant_id,student_id,group_id,billing_period) WHERE billing_period IS NOT NULL;
CREATE TABLE payments(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), invoice_id uuid NOT NULL, amount_centimes bigint NOT NULL CHECK(amount_centimes>0), kind text NOT NULL DEFAULT 'payment' CHECK(kind IN('payment','refund')), method text NOT NULL CHECK(method IN('cash','bank_transfer','ccp','card_external')), reference text NOT NULL DEFAULT '', original_id uuid, created_by uuid NOT NULL REFERENCES users(id), idempotency_key text NOT NULL, fingerprint text NOT NULL, receipt_number bigint GENERATED ALWAYS AS IDENTITY, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,idempotency_key), FOREIGN KEY(tenant_id,invoice_id) REFERENCES invoices(tenant_id,id), FOREIGN KEY(tenant_id,original_id) REFERENCES payments(tenant_id,id));
CREATE INDEX payments_invoice ON payments(tenant_id,invoice_id);
CREATE TABLE cash_closures(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), day date NOT NULL, counted_centimes bigint NOT NULL CHECK(counted_centimes>=0), expected_centimes bigint NOT NULL, notes text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,day));
CREATE TABLE payroll_payments(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), teacher_id uuid NOT NULL, amount_centimes bigint NOT NULL CHECK(amount_centimes>0), month text NOT NULL, reference text NOT NULL DEFAULT '', created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,teacher_id) REFERENCES users(tenant_id,id));
CREATE TABLE announcements(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), group_id uuid, title text NOT NULL, body text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id));
CREATE TABLE notifications(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL, title text NOT NULL, body text NOT NULL, seen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,user_id) REFERENCES users(tenant_id,id));
CREATE INDEX notifications_user ON notifications(tenant_id,user_id,created_at);
CREATE TABLE device_tokens(user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE outbox(id uuid PRIMARY KEY, channel text NOT NULL CHECK(channel IN('email','push')), recipient text NOT NULL, payload jsonb NOT NULL, attempts integer NOT NULL DEFAULT 0, state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','sending','sent','failed')), next_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE materials(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), group_id uuid NOT NULL, title text NOT NULL, filename text NOT NULL, mime text NOT NULL, content bytea NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id));
CREATE TABLE audit(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, entity_id text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE inquiries(id uuid PRIMARY KEY, name text NOT NULL, email text NOT NULL, school text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE VIEW invoice_balances AS SELECT i.*,COALESCE(p.paid_centimes,0)::bigint AS paid_centimes,(i.amount_centimes-COALESCE(p.paid_centimes,0))::bigint AS balance_centimes FROM invoices i LEFT JOIN (SELECT tenant_id,invoice_id,SUM(CASE WHEN kind='payment' THEN amount_centimes ELSE -amount_centimes END) AS paid_centimes FROM payments GROUP BY tenant_id,invoice_id) p ON p.tenant_id=i.tenant_id AND p.invoice_id=i.id;

INSERT INTO schema_migrations(version) VALUES('001.sql');

-- Migration: 002.sql
CREATE UNIQUE INDEX payroll_reference ON payroll_payments(tenant_id,teacher_id,month,reference);
CREATE TABLE cash_openings(tenant_id uuid NOT NULL REFERENCES tenants(id),day date NOT NULL,amount_centimes bigint NOT NULL CHECK(amount_centimes>=0),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,day));
CREATE INDEX lessons_dates ON lessons(tenant_id,starts_at);
CREATE INDEX enrollments_students ON enrollments(tenant_id,student_id);
CREATE INDEX users_active ON users(tenant_id,active,role);
CREATE INDEX outbox_pending ON outbox(next_at) WHERE state IN('pending','sending');

INSERT INTO schema_migrations(version) VALUES('002.sql');

-- Migration: 003.sql
ALTER TABLE lessons ADD COLUMN teacher_id uuid,ADD COLUMN pay_mode text NOT NULL DEFAULT 'session',ADD COLUMN pay_value bigint NOT NULL DEFAULT 0;
UPDATE lessons l SET teacher_id=g.teacher_id,pay_mode=g.pay_mode,pay_value=g.pay_value FROM groups g WHERE g.id=l.group_id AND g.tenant_id=l.tenant_id;
ALTER TABLE lessons ADD FOREIGN KEY(tenant_id,teacher_id) REFERENCES users(tenant_id,id);
ALTER TABLE invoices ADD COLUMN teacher_id uuid,ADD COLUMN pay_percent_bp integer NOT NULL DEFAULT 0 CHECK(pay_percent_bp BETWEEN 0 AND 10000);
UPDATE invoices i SET teacher_id=g.teacher_id,pay_percent_bp=CASE WHEN g.pay_mode='percent' THEN g.pay_value ELSE 0 END FROM groups g WHERE g.id=i.group_id AND g.tenant_id=i.tenant_id;
ALTER TABLE invoices ADD FOREIGN KEY(tenant_id,teacher_id) REFERENCES users(tenant_id,id);

INSERT INTO schema_migrations(version) VALUES('003.sql');

-- Migration: 004.sql
CREATE TABLE school_closures (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), label text NOT NULL,
 starts_on date NOT NULL, ends_on date NOT NULL CHECK(ends_on>=starts_on),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE INDEX school_closures_dates ON school_closures(tenant_id,starts_on,ends_on);
CREATE TABLE lesson_series (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), group_id uuid NOT NULL,
 rule jsonb NOT NULL, fingerprint text NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,group_id) REFERENCES groups(tenant_id,id)
);
ALTER TABLE lessons ADD COLUMN series_id uuid, ADD FOREIGN KEY(tenant_id,series_id) REFERENCES lesson_series(tenant_id,id);
CREATE INDEX lessons_series ON lessons(tenant_id,series_id);

INSERT INTO schema_migrations(version) VALUES('004.sql');

-- Migration: 005.sql
ALTER TABLE auth_sessions ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_id_key UNIQUE(id);
ALTER TABLE auth_sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE auth_sessions ADD COLUMN reauthenticated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE auth_sessions ADD COLUMN device_label text NOT NULL DEFAULT 'Appareil';
CREATE INDEX auth_sessions_user ON auth_sessions(user_id,expires_at);
CREATE TABLE rate_buckets(key_hash text PRIMARY KEY,hits integer NOT NULL,expires_at timestamptz NOT NULL);
CREATE INDEX rate_buckets_expiry ON rate_buckets(expires_at);
CREATE TABLE security_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants(id),user_id uuid REFERENCES users(id),action text NOT NULL,resource text NOT NULL DEFAULT '',outcome text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX security_events_tenant_date ON security_events(tenant_id,created_at);
CREATE TABLE user_mfa(user_id uuid PRIMARY KEY REFERENCES users(id),secret_encrypted text NOT NULL,enabled boolean NOT NULL DEFAULT false,pending_until timestamptz NOT NULL DEFAULT now()+interval '10 minutes',last_counter bigint NOT NULL DEFAULT -1,recovery_hashes text[] NOT NULL DEFAULT '{}');
CREATE TABLE privacy_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),user_id uuid NOT NULL REFERENCES users(id),kind text NOT NULL CHECK(kind IN('access','rectification','erasure','restriction','objection','portability')),message text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN('open','in_progress','completed','refused')),response text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),due_at timestamptz NOT NULL DEFAULT now()+interval '1 month',updated_at timestamptz NOT NULL DEFAULT now(),resolved_by uuid REFERENCES users(id));
CREATE INDEX privacy_requests_tenant ON privacy_requests(tenant_id,created_at);
ALTER TABLE tenants ADD COLUMN privacy_contact text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN retention_policy text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN processing_basis text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN dpo_name text NOT NULL DEFAULT '';

INSERT INTO schema_migrations(version) VALUES('005.sql');

-- Migration: 006.sql
-- Ne pas considérer les anciennes sessions comme fraîchement authentifiées
-- lorsqu'une colonne de sécurité a reçu sa valeur par défaut à la migration.
UPDATE auth_sessions s SET reauthenticated_at=s.created_at
FROM schema_migrations m
WHERE m.version='005.sql' AND s.created_at<m.applied_at AND s.reauthenticated_at=m.applied_at;
UPDATE auth_sessions s SET last_seen_at=s.created_at
FROM schema_migrations m
WHERE m.version='005.sql' AND s.created_at<m.applied_at AND s.last_seen_at=m.applied_at;

INSERT INTO schema_migrations(version) VALUES('006.sql');

-- Migration: 007-single-school.sql
-- EduBest requires a fresh, dedicated database. Never convert another school implicitly.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tenants WHERE slug <> 'edubest') THEN
    RAISE EXCEPTION 'EduBest exige une base dédiée ; aucun établissement existant ne sera converti.';
  END IF;
END $$;
ALTER TABLE tenants ADD CONSTRAINT edubest_only_school CHECK (slug = 'edubest');
CREATE UNIQUE INDEX edubest_single_school ON tenants ((true));
DROP TABLE inquiries;

INSERT INTO schema_migrations(version) VALUES('007-single-school.sql');

-- Migration: 008-delivery-and-role-policy.sql
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

INSERT INTO schema_migrations(version) VALUES('008-delivery-and-role-policy.sql');

-- Migration: 009-registration-requests.sql
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
 CHECK (role IN ('OWNER','MANAGER','CASHIER','SECRETARY','TEACHER','PARENT','STUDENT'));
ALTER TABLE users ADD COLUMN phone text NOT NULL DEFAULT '';
ALTER TABLE groups ADD COLUMN registration_open boolean NOT NULL DEFAULT false;

CREATE TABLE registration_requests (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('STUDENT','PARENT')),
 student_kind text NOT NULL CHECK (student_kind IN ('new','existing')),
 first_name text NOT NULL,
 last_name text NOT NULL,
 phone text NOT NULL,
 email text NOT NULL,
 child_first_name text,
 child_last_name text,
 level text,
 group_ids uuid[] NOT NULL,
 locale text NOT NULL CHECK (locale IN ('fr','ar')),
 status text NOT NULL DEFAULT 'email_pending' CHECK (status IN ('email_pending','pending','approved','rejected')),
 verification_hash text UNIQUE,
 verification_expires_at timestamptz,
 verified_at timestamptz,
 reviewer_id uuid,
 user_id uuid,
 student_id uuid,
 reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 CHECK (cardinality(group_ids) BETWEEN 0 AND 10),
 FOREIGN KEY (tenant_id,reviewer_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY (tenant_id,user_id) REFERENCES users(tenant_id,id),
 FOREIGN KEY (tenant_id,student_id) REFERENCES students(tenant_id,id)
);
CREATE UNIQUE INDEX registration_one_open_email ON registration_requests(tenant_id,email)
 WHERE status IN ('email_pending','pending');
CREATE INDEX registration_queue ON registration_requests(tenant_id,status,created_at);

INSERT INTO schema_migrations(version) VALUES('009-registration-requests.sql');
COMMIT;
