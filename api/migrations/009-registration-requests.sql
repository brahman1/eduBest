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
