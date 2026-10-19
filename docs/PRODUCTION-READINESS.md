# FinTrack 2.0 production-readiness report

Review date: **19 October 2026**. Assessment: **substantially hardened and ready for staging verification; not cleared for production release**. No compliance certification or invented readiness percentage is offered.

## 1. Implementation summary

- Added real authenticated name-update, password-change and password-confirmed account-deletion APIs, preserving existing response envelopes and financial endpoints. Email changes remain read-only until verification exists.
- Added an in-app deletion screen with two explicit confirmation steps and backend-dependent completion; local cleanup occurs after confirmed deletion. Added a separately hosted deletion-page implementation requiring login and current-password verification.
- Added public and authenticated technical privacy notices, registration disclosure, per-scan SMS disclosure/choice, permission-withdrawal guidance and unapproved legal drafts. Removed the unsupported privacy promises, unverified support email, fabricated fallback email, simulated push-notification toggle and visible development-phase wording.
- Added unknown-route recovery, shell page titles, safe direct registration-to-login navigation, small-landscape mobile navigation, password suggestion suppression, multiline validation errors and true disabled-button behavior. Linked functional branding to authentication home/dashboard while leaving decorative previews noninteractive.
- Added browser-local CSV/PDF downloads and stopped silently copying CSV financial contents to the clipboard after storage failure. Goal-to-FIN navigation now passes questions as route state instead of generating URLs containing them; legacy inbound query links remain compatible.
- Tightened production CORS, added credential rate limits and no-store API responses, redacted name/new/current-password validation values, constrained new bcrypt passwords to 72 UTF-8 bytes, rejected insecure release API overrides and added certificate-verified MySQL TLS configuration support.
- Removed the unused image-picker dependency and its exclusive platform/transitive packages. Optimized web icons losslessly, created a branded 32px favicon, constrained logo decode dimensions and disabled Android app backup. Original logo/FIN appearance remains intact.

## 2. Twenty-point UI checklist

PASS means implemented or verified in the inspected scope, not universal manual certification.

| # | Requirement | Status | Evidence / limitation |
|---|---|---|---|
| 1 | No unintended horizontal scrolling | PARTIAL | Core screen matrix passes seven widths/both themes; not every screen/state manually exercised |
| 2 | Working internal/external links | PARTIAL | Direct sign-in recovery and new routes work in source/tests; public hosting/contact links await owner data |
| 3 | Responsive mobile navigation | PASS | Existing bottom navigation/rail retained; short landscape avoids an overflowing rail |
| 4 | Branded web favicon | PASS | Existing approved-in-repository artwork used at 32×32 |
| 5 | Meaningful page/screen titles | PARTIAL | Shell route titles and screen app bars; no full browser title-history interaction test |
| 6 | Unique public indexable descriptions | N/A | Authenticated app and deletion resource are noindex; no public SEO website found |
| 7 | Footer links | N/A | No website footer navigation identified |
| 8 | Custom 404 / unknown routes | PASS | Branded Flutter error recovery without internal error disclosure |
| 9 | Dynamic copyright year | PASS | About dialog and deletion page |
| 10 | Image optimization | PASS | 27,812 bytes saved across web icons, exact decoded pixels verified; original large logos retained when recompression did not help |
| 11 | Every button works | PARTIAL | Repaired account actions, export, direct sign-in, settings recovery and inert toggle; full manual sweep unavailable |
| 12 | Success feedback | PASS | Modified account/import/export flows use actual responses or clearly describe browser download initiation |
| 13 | Errors and recovery | PARTIAL | Actionable retry/permission/storage/deletion errors added; exhaustive offline/failure interaction testing outstanding |
| 14 | Production content | PASS | Identified fake data, unsupported privacy promises and visible phase labels corrected; no final policy invented |
| 15 | Unused navigation | PASS | Simulated notification entry removed; active routes retained |
| 16 | Mobile overflow/clipping/padding | PARTIAL | Core matrix, scrollable SMS tabs, responsive auth footer and shared errors verified; hardware/landscape sweep outstanding |
| 17 | Logo home navigation | PASS | Functional auth/About branding routes home; theme artwork previews remain decorative |
| 18 | Public telephone links | N/A | No approved public business number identified |
| 19 | Public email links | N/A | No approved contact established; unsupported address removed |
| 20 | Every screen/device size | PARTIAL | 320/360/393/430/600/768/1024 core matrix; new screens at 200% text; not every state or hardware form factor |

## 3. Privacy/legal checklist

| Area | Status |
|---|---|
| Privacy Policy, Terms, Account/Data Deletion Policy | Draft requiring review — `legal/` |
| Refund/cancellation, marketing unsubscribe | N/A — no paid subscription/checkout/marketing implementation found |
| Cookie banner / tracking-cookie policy | N/A currently; essential browser storage draft supplied |
| Plain-language SMS choice, registration notice, privacy controls | Implemented |
| FIN data boundary and owner-scoped read-only analytics | Existing safeguards retained and regression tested; wording corrected |
| In-app and web deletion source | Implemented; deletion behaviour rehearsed against a disposable local MySQL fixture (235 passing tests); public deployment still blocked on authorization |
| Verified ownership, password confirmation, rollback, duplicate-request handling | Implemented/tested with mocks and local HTTP API tests |
| Versioned legal consent records, rights/grievance operations | Blocked on approved purposes, notices, business contacts and operational process |
| Retention, backup deletion, incident response and legal holds | Blocked on owner policy/infrastructure verification |
| Children's-data controls and distribution-specific duties | Blocked on actual intended audience/regions; no invasive verification added |
| Certified compliance / WCAG conformance | Not claimed |

Phased commencement and relevant primary sources are recorded in `legal/REVIEW.md`. Drafts remain outside public finalized-policy routes.

## 4. Screens updated

| Screen | Key changes |
|---|---|
| MainNavigationScreen | Web titles, short-landscape navigation, wrapped connection feedback |
| LoginScreen | Branded home action |
| RegisterScreen | Home/sign-in recovery, responsive footer, processing notice/privacy link |
| ProfileScreen | Honest data-control entry, real version/year, deletion entry, removed fake notifications/contact/identity |
| EditProfileScreen | Backend name update, read-only email, actually disabled unchanged save |
| SecurityScreen | Existing form now uses implemented password-change API through AuthProvider |
| PrivacyScreen (new) | Accurate technical disclosure, native permission settings/recovery |
| DeleteAccountScreen (new) | Password, typed confirmation, second confirmation, errors, confirmed deletion/logout |
| SmsImportScreen | Notice/decline before scans and retry scans, platform guidance, scrollable tabs, import feedback |
| AnalyticsScreen / FIN | Honest backend-processing/privacy text; removed development labels and guarantees; full character/animation retained |
| GoalDetailScreen | Questions passed privately as route state |
| ReportsScreen | Native/browser export paths and accurate failure/download feedback |
| Unknown-route view (new router fallback) | Branded return-to-app recovery |

Shared AppButton, AppTextField and FinTrackLogo changes apply across consuming screens. Complete route/screen inventory: `REPOSITORY-INVENTORY.md`.

## 5. Backend changes

- `PUT /api/auth/me`: validates name/email, updates authenticated user's name, rejects unverified email changes.
- `PUT /api/auth/password`: verifies current password, hashes replacement, uses conditional update to detect concurrent credential changes.
- `DELETE /api/auth/me`: requires bearer auth, current password and exact DELETE confirmation. Locks the user and removes child data in a single transaction with foreign keys enabled. Errors roll back and never report fake success.
- `GET /account-deletion/`: static external deletion-page source with local assets, labels, confirmation, live feedback and memory-only token. Credentials and financial records are not sent to third parties.
- Existing auth/financial API contracts remain covered by regression tests. No migrations added/applied; no production database touched. Runtime schemas must be checked against migrations 0001–0007, triggers and any additional personal-data stores.
- CORS, no-store, validation redaction, rate limits, TLS configuration and provider-boundary disclosure changes described above. Local loopback origins remain available outside production.

## 6. Third-party audit

No advertising, analytics-tracking, marketing, payment or crash-reporting SDK was identified. Packages reviewed include Dio, Provider, go_router, secure storage, SharedPreferences, connectivity, PDF/path storage, SMS/permission plugins, crypto, charts/icons; Express, MySQL2, bcrypt/JWT, validation/security/logging/Swagger middleware. Image picker was confirmed unused and removed.

Render is the existing configured API host. MySQL provider/region is unresolved. Groq/Google Gemini adapters can style only exact generic catalog phrases when explicitly enabled; financial data and questions remain blocked. No external model received user data during this work.

### 6.1 Persistent storage and cache architecture

The application's storage paths have been audited and strictly partitioned:
- **Encrypted native financial response caches**: Managed by `CacheService` using `FlutterSecureStorage` with user-scoped keys (`fintrack_secure_cache_v1_${userId}_${key}`). On native devices (Android/iOS/Desktop), payloads are encrypted using platform keystores/keychains (AES-256 GCM / EncryptedSharedPreferences). Operates fail-closed: if platform secure storage fails, no plaintext fallback is written. Startup initialization automatically purges any legacy plaintext response caches from `SharedPreferences`. Responses expire after 24 hours. Sign-out clears all secure response cache keys.
- **Memory-only web financial caches**: In web environments (`kIsWeb`), `CacheService` enforces memory-only storage (`_memoryOnly = true`). Financial responses are stored strictly in volatile Dart heap memory (`Map<String, String> _memory`) and are never written to `localStorage` or `IndexedDB`. All cached financial data is wiped on page reload or sign-out.
- **Nonfinancial preferences**: Persisted in plaintext `SharedPreferences` for non-sensitive UI settings (e.g. selected theme collection, UI preferences prefixed with `fintrack_user_${userId}_`, and `last_sms_import_time`). Legacy financial cache keys are removed from preferences at startup.
- **Session / token storage**: Managed separately by `TokenService` using `FlutterSecureStorage` under key `access_token`. Protected from cache clear erasures (`CacheService.clearAll()` specifically avoids `deleteAll` so the session token is preserved). On signout, `TokenService.removeToken()` actively deletes the token and sets an in-memory guard flag. Backend JWTs incorporate HMAC credential binding, invalidating all sessions upon password change.
- **Exported financial reports**: Generated PDF and CSV statements are saved to the device's `getApplicationDocumentsDirectory()` on native platforms, or downloaded via browser Blob URLs on web. These user-initiated files are stored as standard unencrypted documents outside application cache management; they rely on native OS application sandboxing.

## 7. Actual verification

Final security-hardening verification run (same date, after the fixes in section 7.1):

| Check | Outcome |
|---|---|
| `flutter analyze` | PASS — clean, 0 issues found |
| `flutter test` (full suite) | PASS — 302 passed, 1 explicit integration skip (`test/api_client_test.dart` opt-in health test), 0 failed |
| Focused final privacy/FIN tests | PASS — 32 tests across FIN companion, smart-transaction SMS import and global FIN overlay files |
| `npm test` (full backend suite) | PASS — 229 tests: 228 passed, 0 failed, 1 explicit disposable-DB skip |
| `npm run test:isolated` (disposable MySQL) | PASS — 235 tests: 235 passed, 0 failed, 0 skipped against a fresh identity-verified database, then server stopped and generated data directory removed |
| Disposable MySQL cleanup | VERIFIED — no runner-owned `mysqld` process and no `fintrack-isolated-mysql-*` temp directory remained; the installed Windows MySQL service was never used |
| `flutter build apk --debug` | PASS (earlier in this work); not re-run in the final pass |
| `flutter build web` | PASS (earlier in this work); recorded in web-build.log |
| New deletion tests | PASS — ownership scoping, wrong password, duplicate, rollback, unauthenticated HTTP rejection, validation/redaction |
| npm advisory check | PASS — zero reported vulnerabilities across 150 dependencies |
| OSV Pub check | PASS — zero findings for 100 locked hosted packages |
| Git diff whitespace checks | PASS for both repositories; existing line-ending warnings only |
| Local deletion-page HTTP smoke | PASS — HTML, fields, JS/CSS and CSP; no form submitted |
| Manual browser / native interaction | NOT VERIFIED — no browser surface connected; no emulator/device testing was performed |
| Production database rehearsal | NOT RUN — only a disposable local fixture was used; no production database or migration was touched |

### 7.1 Defects found and fixed during final verification

Two real defects blocked the final pass. Neither was worked around by weakening assertions or skipping tests.

1. **Secure-cache serialization deadlock (`frontend/lib/core/services/cache_service.dart`).** The serialization queue kept a stored `Future` after it had completed. Widget tests run each `testWidgets` body in its own fake-async zone, and a callback attached to a completed future created in an earlier zone is still scheduled in that dead zone, so every later cache read in the same isolate never ran (`SER start` with no continuation). In production this reproduced as stalls after the first cached read of a session; in tests it hung FIN companion screens until the 10-minute test timeout. Fix: drop the queue reference once it drains, so a later caller starts a fresh chain while writes/erasure remain strictly serialized and session-scoped. This single fix cleared both the FIN pending-timer failures and every 10-minute test timeout.
2. **`AccountProvider` notified after disposal (`frontend/lib/providers/account_provider.dart`).** An in-flight `loadAccounts` completing after the widget tree was disposed raised "A AccountProvider was used after being disposed" in the SMS import screen test. Fix: guard `notifyListeners()` with a disposal flag and cancel the in-flight request in `dispose()`.

Preserved and re-verified in the same runs: JWT session invalidation (session-binding tests), encrypted/secure financial caching with fail-closed behaviour, account-deletion confirmation and rollback safeguards, per-scan SMS consent, FIN companion behaviour and the Midnight Aurora theme.


The first full Flutter run in this work failed only at the pre-existing test that unconditionally contacted local `/health`. It now requires explicit `--dart-define=FINTRACK_RUN_LOCAL_INTEGRATION=true`; it was skipped, never simulated as passed. That skip is the single `~1` in the final Flutter totals. The web build's Wasm dry-run message is informational; the JavaScript build succeeded.

FIN tests cover full-body states, preferences, overlay behavior, dialog/keyboard obstruction and reduced motion. Screen matrix tests cover both themes and seven requested widths. TalkBack/VoiceOver, complete contrast/focus review, hardware foldables/landscape, browser downloads and live authenticated deletion still require interaction verification.

## 8. Remaining risks

**High:** production deletion rehearsal/schema inventory and backup/legal-hold handling; real operator/contact/grievance identity and finalized policies; public deletion URL/store declaration verification; actual age/market decision and corresponding legal controls; SMS restricted-permission approval.

**Medium:** exported financial reports (PDF/CSV) saved to native device app documents storage remain unencrypted files outside the app cache lifecycle (relying on device OS sandboxing); nonfinancial user preferences remain in plaintext SharedPreferences; session invalidation without credential change (e.g. active token blacklist or centralized session table) is not implemented; password recovery and email verification are not implemented; legally sufficient consent evidence and rights handling remain unfinished; provider TLS/grants/regions and durable security-log retention need verification; manual accessibility/device/download tests remain incomplete; the disposable-MySQL rehearsal proves behaviour on a fresh schema but not on the real production schema or data volume.

Resolved during this final pass: the FIN/cache stall and post-disposal provider notification defects (section 7.1); the disposable-MySQL integration suite now runs to completion instead of hanging; token invalidation on password change, secure caching, account-deletion rollback, SMS consent, FIN behaviour and Midnight Aurora were all re-verified green.

**Low:** asset/font provenance evidence remains unverified; available dependency updates need routine review; remaining browser title/deep-link behavior and public-resource presentation need a final real-browser check.

## 9. Owner actions genuinely required

1. Supply/approve operator identity, privacy/grievance contact, actual target regions and age policy; review the policy drafts.
2. Confirm processors/regions, retention/backups/holds, incident and rights-request processes; approve any required consent-evidence/session schema planning.
3. Confirm whether the production schema matches migrations 0001–0007 (the disposable fixture did) and rehearse deletion against a staging copy including backups/holds.
4. Separately authorize release/deployment; verify the external HTTPS deletion URL and complete Google Play privacy/Data Safety/SMS declarations. No deployment is inferred from this request.
5. Enable a usable test device/browser session for manual interaction and assistive-technology checks; supply asset/font provenance evidence.

## 10. Git status and work boundaries

Frontend/backend are separate repositories; the shared workspace root has no Git repository. `GIT-STATUS.md` contains the exact changed/untracked paths captured before this final pass. After the final fixes the working trees show 98 modified/untracked entries under `frontend/` and 32 under `backend/`, all uncommitted; the final pass added `frontend/lib/core/services/cache_service.dart` (modified further), `frontend/lib/providers/account_provider.dart`, `backend/test/support/closeTestDbPool.js` and one import line in each of the five `backend/test/phase5*.test.js` files. Existing README, app icons, Info.plist, main.dart, SMS parser, backend package metadata and migration documentation changes were not reset or overwritten. SDK-generated desktop plugin registration changes reflect image-picker removal. Shared root `docs/` holds these artifacts outside both repository roots.

No commit, push, deployment, production schema migration or production database mutation occurred. Backend .env secrets were not read or changed. No global Git configuration was changed. Temporary audit cache was removed; local preview/test processes were stopped after verification.
