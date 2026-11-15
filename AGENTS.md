# EduBest

This repository is a standalone, single-school project. Keep Midad's source,
database, Render service, credentials and Git remote unchanged.

- All shell commands must start with `rtk` (use `rtk proxy` when needed).
- Exactly one school with internal slug `edubest`; public admission requests for families require email confirmation and staff approval before account activation. No public school creation or school selector.
- Never point migrations, fixtures or demo scripts at Midad's database.
- Test fixtures may reset only the explicitly activated `edubest_test` database.
- Do not commit `.env`, `.local`, databases, native signing material or demo access files.
- Preserve French/Arabic and per-role authorizations on web and mobile.
- Read `web/AGENTS.md` and the installed Next documentation before web edits.
- Do not deploy, buy a domain or activate paid services without an explicit request.
