# Account and Data Deletion Policy — UNAPPROVED DRAFT

**OWNER REVIEW:** operator identity, verified contact, public URL, effective date, backup schedule, legal retention exceptions and support for users who cannot authenticate.

In the app, open Profile → Delete account & data. Enter your current password, type DELETE and confirm. The backend independently authenticates your session, checks your current password and deletes only the account identified by that session. A submitted user ID cannot select another person's account.

The backend also serves `/account-deletion/`. Once deployed and verified, users can sign in there with their FinTrack email and current password and request deletion without reinstalling the app. The page keeps its temporary bearer token in memory and does not persist credentials in cookies, URLs or local storage. **OWNER: publish and verify the actual HTTPS URL, and supply it in the store listing. No deployment was performed.**

The deletion transaction removes FIN preferences, goal contributions and goals, detected SMS review records, transfers, account adjustments, transactions, budgets, accounts/wallets and the user profile from the active application database. Shared category definitions and migration history are not personal account records and remain. Foreign keys stay enabled. Missing or incompatible schemas cause rollback and an error; successful deletion is not simulated.

After confirmed deletion, the app clears its current session and app-managed caches. Tokens for the deleted user no longer authenticate because backend authentication requires an existing user. Other devices can retain offline copies until signed out. User-exported PDF/CSV files are not recalled. Phone messages and real bank accounts are unaffected.

A repeated request with the old credentials cannot authenticate after deletion. Network loss can make completion uncertain: no completion claim should be shown without a successful backend response. Failure messages invite retry; if the account was already deleted, subsequent login will fail.

**Unresolved:** backups are not synchronously erased by this endpoint. Hosting logs, backup expiry, legal holds, restore procedures and any retention exceptions require a documented operational process. No time period or exception is invented here. The current deployment must be checked for additional user-data tables before enabling the release; this code targets the checked-in migrations 0001–0007.

**Unresolved:** the app has no password-recovery delivery service. The owner must provide a verified ownership-recovery/request channel for people who have lost access, with appropriate safeguards against fraudulent deletion.
