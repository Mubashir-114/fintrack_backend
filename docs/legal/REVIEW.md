# FinTrack legal and release review — 19 October 2026

All documents in this directory are **DRAFTS REQUIRING OWNER AND LEGAL REVIEW**. They are not published policies, contractual acceptance, or a compliance certification. The app exposes a technical data notice, not these unapproved drafts.

## Verified legal and store sources

The official [DPDP Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) establishes publication, one-year and eighteen-month groups. The [final 2025 Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) commence Rules 1, 2 and 17–21 on publication, Rule 4 after one year, and Rules 3, 5–16, 22 and 23 after eighteen months. Using the printed 13 November 2025 date, the later milestones compute to 13 November 2026 and 13 May 2027; counsel should confirm publication-date interpretation and subsequent changes. As of this review, do not describe the entire regime as already operative. Most substantive processing, notice, rights and children's-data requirements belong to the later group. Build readiness now without claiming compliance.

[Google Play deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) require accessible in-app and external web pathways. The implemented backend path is `/account-deletion/`; actual public hosting and the store listing still need verification. [Google's SMS policy](https://support.google.com/googleplay/android-developer/answer/10208820) lists SMS money management as an exception subject to review. Keeping READ_SMS requires the appropriate Play declaration and approval; permission alone does not establish approval.

The [SPDI Rules text](https://www.wipo.int/wipolex/en/text/494931) includes passwords and financial information. Counsel must assess the operator's current IT Act/SPDI duties during the transition. [CERT-In's directions](https://www.cert-in.org.in/Directions70B.jsp) require an applicability review for incident reporting and security-log retention. Current local Winston rotation is 14 days; a retained, access-controlled operational logging system and incident response process need owner verification. Do not retain financial content in logs to meet security-log requirements.

## Owner decisions blocking final publication

- Operator/developer identity matching the store listing, real contact and grievance channel, applicable address and accountable personnel.
- Actual distribution regions and intended audience. No adults-only or minors-permitted policy was evidenced. No arbitrary age gate, date-of-birth collection, identity document collection or parental-consent claim was added. If children are permitted, approve a verifiable parental-consent and children's-data design before release where required. The DPDP child definition is under 18; the substantive safeguards follow the staged commencement noted above.
- Hosting/database operators, regions, subprocessors, contracts and international-transfer conditions. Render is the configured API host; the actual MySQL provider and jurisdiction are not established by code.
- Record, staging-data, backup and log retention schedules; deletion exceptions, backup restore suppression and rights-request response process.
- Versioned notice/consent evidence and withdrawal handling where legally required. The implemented per-scan choice and OS permission are technical controls, not a claim that legally sufficient consent records exist.
- Privacy Policy/Terms approval, effective dates, publication URLs, store Data Safety declarations and SMS restricted-permission approval.
- Other jurisdictions: assess GDPR/UK GDPR or other local requirements only after intended markets and users are confirmed. No EU representation or worldwide compliance is claimed.

## Not applicable in the inspected implementation

No subscriptions, checkout, paid entitlement, marketing email, ads or third-party analytics tracker was found. Refund/cancellation policy, unsubscribe service and nonessential-cookie banner are not applicable to the present feature set. Essential browser storage is documented in STORAGE-NOTICE.draft.md. No decorative native cookie banner was added.

No OTP delivery or verification implementation was found; none was invented or claimed verified.
