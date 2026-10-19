# Release operations — review before production use

No deployment, production schema change, database mutation, commit or push is authorized by this work.

## Deletion safety

1. Compare production schema metadata against migrations 0001–0007 without applying migrations. Inventory every table containing user data, cross-user foreign-key anomalies, database triggers, external stores and retention holds.
2. Exercise password-confirmed deletion in a disposable local/staging database populated with at least two synthetic users, all child-record types and failure injection. Verify transaction rollback, FK order, unaffected second-user balances, duplicate requests and old-token rejection. Automated rehearsal against a fresh disposable MySQL fixture is fully verified (235 passed tests via `npm run test:isolated`); prior to production rollout, repeat rehearsal against a staging database mirroring exact production triggers and data volumes.
3. Review backup retention, restoration suppression and support for failed/lost-credential requests. If retention holds exist, implement their approved policy before enabling hard deletion. This repository has no legal-hold data model.
4. Publish `/account-deletion/` only with the backend release and verify it via HTTPS from outside the operator network. It must use the same backend and cannot depend on the app being installed. The checked-in page is functional source, not evidence of public hosting.

No new migration is necessary for the implemented endpoints. Do not apply the reconstructed baseline to an existing database. Unrecognized schema failures roll back, rather than skipping data or disabling foreign keys.

## Configuration and infrastructure

- Configure exact production HTTPS CORS origins. Development loopback origins are accepted automatically only outside production. Native requests without Origin remain supported.
- Configure verified `DB_SSL=true` and, if needed, `DB_SSL_CA`; analytics inherits those values unless `ANALYTICS_DB_SSL` / `ANALYTICS_DB_SSL_CA` override them. Never use `rejectUnauthorized=false`. Validate the actual host and provider CA in staging first.
- Keep separate least-privilege write and read-only analytics users. Review grant provisioning, Render secrets, database access restrictions, TLS, backups and provider regions. No secret values were read or changed.
- JWT lifetime remains seven days. Tokens now carry an opaque HMAC credential binding; changing the password hash revokes every old token, and account deletion invalidates tokens through the existing-user lookup. Rollout rejects unbound legacy tokens, requiring one-time sign-in. No session schema migration is needed.
- Establish an incident response contact, recovery drills and retained security-log storage appropriate to actual law and region. Local rotating files alone are not a durable Render retention solution.
- Native financial response caches use platform secure storage (`FlutterSecureStorage`); web financial caches are strictly memory-only (never written to `localStorage` or `IndexedDB`). Cached responses expire after 24 hours. Startup purges legacy plaintext caches from `SharedPreferences`. Secure-storage failure never falls back to plaintext. Nonfinancial preferences remain in `SharedPreferences`. Exported report files (PDF/CSV) are saved to device application documents on native or downloaded directly in browser, outside the application cache lifecycle. Platform/device backup verification remains outstanding.
- Complete versioned consent/notice records where required after approving purposes, wording, age policy and retention. Current SMS flow requires a fresh explanatory choice for each user-triggered scan; OS permission can be withdrawn in Settings. FIN preference controls already exist.

## Assets and accessibility

Lossless optimization keeps original character/logo pixels. Web favicon is now 32×32, derived from the repository's FinTrack logo. Confirm logo, illustrations and all font licenses/provenance with the owner; source availability alone does not establish licensing.

The screen matrix covers seven widths in both themes; new privacy screens also have 200% text checks. TalkBack, VoiceOver, keyboard-only browser use, full contrast measurement, landscape/foldable hardware and real device flows remain required. A Flutter widget test is not a manual device test or WCAG certification.
