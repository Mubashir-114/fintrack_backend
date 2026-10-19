# FinTrack Privacy Policy — UNAPPROVED DRAFT

Owner review required. Effective date, operator identity, privacy contact, grievance channel and distribution regions are **UNRESOLVED — DO NOT PUBLISH AS FINAL**.

FinTrack provides personal finance tracking, reports, budgets, planning and FIN. Account registration collects a name, email and password. The backend stores a password hash, rather than a recoverable password. Authentication uses a bearer token. This build has no email verification or OTP service.

We process the accounts and wallet details, balances, transactions, categories, notes, budgets, goals and contributions you supply or approve to provide these features. The application does not execute transactions against your bank or independently retrieve bank balances. Enter only data needed for your records; do not enter bank passwords or full payment credentials.

Optional Android SMS import requests access after an explanatory notice and a choice to continue. It reads the inbox on the device, identifies financial messages and sends detected financial-message information to the FinTrack backend for review. Staging records can include sensitive message information. Approval is required before a detected transaction changes the ledger. Declining import preserves manual entry. Revoke SMS access in device settings to stop future reads; previous imports remain until deleted. FIN does not independently read SMS.

FIN analyzes authorized financial records already stored in FinTrack. Backend analytics use a separate read-only database identity. Questions and financial records are blocked from external model providers. If an operator enables external wording, only fixed context-free catalog phrases can go to Groq or Google Gemini; personal preferences, questions and financial records are not part of that payload. This is backend processing, not a claim that all processing stays on your phone.

The configured API is hosted on Render. A MySQL database stores account and financial records. **OWNER: identify actual database provider, regions, subprocessors, contractual safeguards and any additional hosting or diagnostic services.** No advertising or third-party analytics SDK was identified. The unused image-picker dependency was removed. Network and storage packages support service delivery; they are not a basis for claiming no third-party processing.

Access tokens use platform secure storage. Native offline financial responses use platform secure storage. Web financial response caches remain in memory and are not persisted. Cached responses expire after 24 hours; replaced plaintext response caches are purged at startup. Browser storage does not provide the same guarantees as native secure storage. Signing out clears app-managed caches and session state. Android cloud backup is disabled in the application manifest; exported reports and other devices' caches remain under their respective controls.

Release API traffic uses HTTPS; release URL overrides must also use HTTPS. The backend supports verified MySQL TLS when configured. Ownership checks, validation, rate limits and query-parameterized database access reduce risk. No absolute security or hardware-backed-storage guarantee is made.

You can view your records and edit your display name. Email changes require a verification service and are unavailable in this build. Change your password through Security & Password; this revokes all prior sessions and requires signing in again. Delete your account through Profile → Delete account & data or the separately hosted account-deletion page using your current credentials. See the deletion draft for the exact technical scope. **OWNER: provide verified contact and procedures for access, correction, consent withdrawal, grievances and other applicable rights.**

**OWNER: approve retention periods** for active records, unconfirmed SMS candidates, logs, backups and any legal exceptions. There is no scheduled purge of old account or financial records in this change. Do not describe data as erased from all backups immediately.

**OWNER: decide age policy** and approve child-related safeguards before accepting children where required. FinTrack currently has no parental-consent mechanism. No marketing opt-in or subscription is implemented. Material policy changes and notification procedures require owner approval.
