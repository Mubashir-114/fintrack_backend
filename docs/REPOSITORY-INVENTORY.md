# Repository inventory and implementation checklist

Inspected 19 October 2026. Source review and automated checks do not establish manual interaction coverage. The workspace root is not a Git repository. Frontend and backend are separate Git repositories; per-command safe.directory overrides were needed to inspect them under the sandbox identity. Existing README, native icon, Info.plist and other unrelated changes were retained. Secret .env values were not inspected.

## Routes

- `/privacy`
- `/splash`
- `/login`
- `/register`
- `/accounts/add`
- `/accounts/:id/edit`
- `/dashboard`
- `/transactions`
- `/sms-import`
- `/budgets`
- `/reports`
- `/analytics`
- `/planning`
- `/planning/goals/:id`
- `/profile`
- `/profile/privacy`
- `/profile/delete`
- `/profile/edit`
- `/profile/security`
- `/profile/appearance`
- `/accounts`
- `/accounts/transfer`
- `/accounts/:id`

## Screens and contained form labels

| File | Screen classes | Field labels found in source |
|---|---|---|
| `frontend/lib/screens/accounts/account_detail_screen.dart` | AccountDetailScreen | Amount (${_account?.currencyCode ?? , Reason / Memo, Type, Subtype, Currency, Card Issuer, Card Number, Status, Type, Subtype, Currency, Institution, Account No., Status, Default Account, Current Ledger Balance, Opening Amount, Total Inflow (Income), Total Outflow (Expenses), Transfers In, Transfers Out, Net Adjustments |
| `frontend/lib/screens/accounts/accounts_list_screen.dart` | AccountsListScreen | Asset Accounts, Credit Cards |
| `frontend/lib/screens/accounts/add_account_screen.dart` | AddAccountScreen | Account Name *, Last 4 Digits (Optional), Credit Limit * |
| `frontend/lib/screens/accounts/edit_account_screen.dart` | EditAccountScreen | Account Name *, Institution Name *, Last 4 Digits (Optional), Account Type, Currency, Credit Limit |
| `frontend/lib/screens/analytics/analytics_screen.dart` | AnalyticsScreen | Total Spending, Income vs Expenses, Financial Insights, Spending by Category, Spending Trend, Category Comparison, Largest Expenses, Unusual Spending, Food Budget Status, Remaining Allowance, Savings Opportunities, Savings Affordability, Recommended Saving, Goal Status, Forecast Explanation, Calculation Methodology, Total Spending, By Category, Spending Trend, Budget Status, Savings Opportunities, Income vs Expenses |
| `frontend/lib/screens/auth/login_screen.dart` | LoginScreen | Email address, Password |
| `frontend/lib/screens/auth/register_screen.dart` | RegisterScreen | Full Name, Email Address, Password, Confirm Password |
| `frontend/lib/screens/budgets/budgets_list_screen.dart` | BudgetsListScreen | Target Amount, Month, Year |
| `frontend/lib/screens/dashboard/dashboard_screen.dart` | DashboardScreen | LEDGER ACCURATE, Net savings trend. ${values.map((item) => , Income, Expenses, Net Savings (Cash Flow), TOP · ${dashboardProvider.topMerchants[0].merchant.toUpperCase()} |
| `frontend/lib/screens/main_navigation_screen.dart` | MainNavigationScreen | Home, Activity, Budgets, Reports, Profile |
| `frontend/lib/screens/planning/goal_detail_screen.dart` | GoalDetailScreen | Target Deadline, Required Monthly Pace, Estimated Completion Date |
| `frontend/lib/screens/planning/planning_screen.dart` | PlanningScreen |  |
| `frontend/lib/screens/profile/appearance_screen.dart` | AppearanceScreen |  |
| `frontend/lib/screens/profile/delete_account_screen.dart` | DeleteAccountScreen | Current password, Type DELETE to confirm |
| `frontend/lib/screens/profile/edit_profile_screen.dart` | EditProfileScreen | Full Name, Email Address |
| `frontend/lib/screens/profile/privacy_screen.dart` | PrivacyScreen |  |
| `frontend/lib/screens/profile/profile_screen.dart` | ProfileScreen |  |
| `frontend/lib/screens/profile/security_screen.dart` | SecurityScreen | Current Password, New Password, Confirm New Password |
| `frontend/lib/screens/reports/reports_screen.dart` | ReportsScreen |  |
| `frontend/lib/screens/splash/splash_screen.dart` | SplashScreen |  |
| `frontend/lib/screens/transactions/sms_import_screen.dart` | SmsImportScreen | Ambiguous (**${tx.maskedAccountHint ?? , Select Account, Merchant Name, Classification, Account, Category |
| `frontend/lib/screens/transactions/transactions_list_screen.dart` | TransactionsListScreen | Newest First, Oldest First, Highest Amount, Lowest Amount, All, Expense, Income, Title / Merchant, Account (Optional), Transaction Date, Note (Optional) |
| `frontend/lib/screens/transfers/transfer_screen.dart` | TransferScreen | From Account, To Account, Amount (INR), Note (Optional) |

## Shared UI, responsiveness and FIN

MainNavigationScreen uses mobile bottom destinations and a tablet navigation rail. Short landscape viewports now keep mobile navigation to avoid rail overflow. Shared AppButton, AppTextField, SettingsTile, FinSurface, CustomToast, EmptyState, skeleton/loading scenes and chart widgets provide common behavior. FIN has a dedicated AnalyticsScreen, custom-painted full-body character, visual controller, global peeking overlay and persisted companion preferences. Existing keyboard, dialog, safe-region, foldable-region and reduced-motion handling was retained. Native and web routes share go_router; authenticated application routes are not SEO landing pages.

## Assets and platforms

Flutter includes Android, iOS, web, Windows, Linux and macOS scaffolding. Android and web were targeted for builds; other scaffolding is not evidence of supported release distribution. Three existing branded logo PNGs, launcher variants, app icons, splash resources and a README banner are present. FIN uses code-native painting/animations, not replaced bitmap artwork. No bundled font license/provenance evidence was established. Material/Cupertino icon packages remain. Asset compression evidence is in asset-optimization.json.

## Initial requirement classification

| Scope | Initial classification | Action / result |
|---|---|---|
| Mobile navigation, shared buttons/fields, theme collections | Already implemented | Retained; short-landscape and shared field fixes added |
| Responsive FIN, reduced motion, popup/keyboard hiding | Already implemented | Preserved; expanded regression matrix |
| Unknown route recovery, page titles, favicon size | Required | Added recovery and shell titles; branded 32px favicon |
| Profile editing and password actions | Required | Implemented APIs; name editable, email verification explicitly unavailable |
| Account deletion (app + web) | Required | Implemented transaction and authenticated public-page source; deployment/staging verification outstanding |
| Accurate privacy and FIN disclosures | Required | Replaced unsupported claims and supplied technical notices |
| SMS pre-permission explanation and choice | Required | Added per-scan notice, decline path and settings guidance |
| Final legal policies, age/regions/retention/contact | Required | Unapproved drafts and owner review blockers |
| Versioned legal consent records | Required if approved processing basis requires them | Owner policy/schema design remains outstanding; no fake consent receipt |
| Ads, marketing subscriptions, unsubscribe, paid refunds | Not applicable | No corresponding implemented services found |
| Nonessential browser cookie banner | Not applicable | No tracking cookie flow identified; essential storage draft supplied |
| Website footer navigation, public phone/email links | Not applicable | No marketing website/footer or approved public contacts found; unverified support address removed |
| OTP functionality | Not applicable to inspected implementation | No OTP implementation found; existing password auth retained |

## Packages and processors

Backend: Express, MySQL2, bcrypt, JWT, validation, Helmet, CORS, rate limits, compression, dotenv, Swagger, Morgan/Winston, and cookie-parser. No payment, advertising, email delivery or crash reporting integration was found. MySQL pools include verified TLS configuration support; actual provider TLS and grants require operational verification.

Flutter: Dio, Provider, go_router, secure storage, SharedPreferences, intl, fl_chart, connectivity_plus, pdf, path_provider, flutter_sms_inbox, permission_handler, crypto and icon packages. The unused image_picker dependency and 14 exclusive transitive/platform dependencies were removed. No analytics, advertising or crash reporting SDK was identified. Packages are not an assurance that runtime infrastructures lack telemetry.

External model integrations: Groq/Google Gemini adapters exist for optional fixed context-free phrases. Default-deny policy, exact phrase allowlisting and tests exclude financial records, questions, names and preferences. No financial inference is delegated to those providers. Render appears in the configured release API URL. Database operator, deployment logs and regions require owner confirmation.

## Permissions, storage and security

Android declares INTERNET and READ_SMS. No new sensitive permission was added. SMS reads are optional and user-initiated. Android cloud backup is disabled. Secure storage holds tokens and native financial response caches (`FlutterSecureStorage`). Web financial caches are strictly memory-only. SharedPreferences holds only nonfinancial preferences (`fintrack_user_*`, `last_sms_import_time`). Exported financial reports (PDF/CSV) are saved to the device documents directory on native or downloaded via browser on web outside the cache lifecycle. MySQL holds profiles and financial records, including detected SMS staging. Logout resets provider state and purges app-managed secure financial caches. Existing authorization and user-scoped financial queries were retained, and backend regression tests cover calculations and contracts. No production schema/data changes were made.

Authentication uses email/password and seven-day JWTs, with an existing-user lookup on each protected request. New credential rate limits, no-store API responses, password-field redaction, release HTTPS override validation and production CORS tightening were added. Password changes immediately invalidate all outstanding JWT sessions via HMAC credential binding (`sessionBinding.js`, verified in `test/sessionSecurity.test.js`). Account deletion requires current-password confirmation, executes cascading removal within a single database transaction, and immediately invalidates active sessions.

## Verification limitations

No browser surface was connected to computer-use, and the Pixel 5 emulator did not remain available as a usable connected Android target. Automated testing is complete and verified: 302 passed Flutter tests (1 expected skip for the opt-in local integration health test; clean analyze) and 235 passed backend tests against a disposable isolated MySQL fixture (`npm run test:isolated`). Production database rehearsal against live customer data volumes, manual assistive technology sweeps (TalkBack/VoiceOver), and real device interaction tests remain outstanding.
