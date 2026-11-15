-- EduBest requires a fresh, dedicated database. Never convert another school implicitly.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tenants WHERE slug <> 'edubest') THEN
    RAISE EXCEPTION 'EduBest exige une base dédiée ; aucun établissement existant ne sera converti.';
  END IF;
END $$;
ALTER TABLE tenants ADD CONSTRAINT edubest_only_school CHECK (slug = 'edubest');
CREATE UNIQUE INDEX edubest_single_school ON tenants ((true));
DROP TABLE inquiries;
