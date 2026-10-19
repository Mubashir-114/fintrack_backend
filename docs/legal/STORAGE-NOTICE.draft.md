# Browser storage notice — UNAPPROVED DRAFT

No nonessential tracking cookies, advertising cookies or marketing trackers were identified. `cookie-parser` is installed on the backend but no application cookie-setting flow was identified. An advertising-style cookie consent banner and separate tracking-cookie policy are currently **not applicable**.

The Flutter web app uses browser implementations of secure storage and SharedPreferences for session tokens and ordinary preferences. Financial response caches stay in memory only and expire after 24 hours; they are not persisted to browser storage. These are essential application storage, can contain personal data and must be disclosed even without HTTP cookies. Their security differs from native platform storage. Sign out to clear app-managed sessions and caches. Browser data controls can also remove local storage; they do not delete server records.

The public account-deletion page does not persist its temporary login token or credentials. Report downloads create local browser Blob URLs and files only, with no upload or telemetry. Hosting access logs and infrastructure configuration require owner verification.

**OWNER REVIEW:** inventory actual deployed storage, hosting-added cookies and any subsequently added analytics. Classify storage under each distribution region's law. Gate future nonessential trackers behind appropriate consent before loading them. Do not treat this draft as consent or an approved legal policy.
