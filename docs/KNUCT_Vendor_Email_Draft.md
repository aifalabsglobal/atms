Subject: AIMSCS — Knuct integration diligence (Phase 0 questionnaire)

To: [Knuct vendor contact]
Cc: [AIMSCS IT / project lead]

---

Dear Knuct Team,

AIMSCS (Smart Campus Management System) is evaluating Knuct as an optional decentralized identity and audit-anchoring layer for our campus platform. We have completed a Phase 1 wallet/DID adapter (mock mode) and Phase 3 hash-only audit anchoring in PostgreSQL, and we are preparing a bounded pilot cohort.

Before enabling live traffic (`KNUCT_ENABLED=true`) or scoping verifiable credentials (Phase 2), we need written answers to **10 technical and compliance questions** attached in our questionnaire:

**Attachment:** `docs/KNUCT_Vendor_Questionnaire.md` (also available on request as PDF)

**Summary of what we need:**

1. Private share format specification  
2. Certificate mint / publish / verify API documentation  
3. Production authentication and tenant isolation model  
4. Error codes and safe retry semantics  
5. `starttempnode` scaling model (1:1 vs shared)  
6. Campus-scale cost and concurrency limits  
7. DID interoperability (W3C resolver or roadmap)  
8. Data residency and DPDP (India) DPA availability  
9. Dedicated staging tenant (separate from public dev sandbox)  
10. Passphrase lifecycle after privshare download  

**Our integration today (for your review):**

- Adapter pattern at `src/lib/knuct/` — mock by default  
- Privshare encrypted at rest (AES-256-GCM); PostgreSQL is system of record  
- SHA-256 audit anchors on attendance, grades, violations, geofences, calendar, masters  
- Public hash verification: `/verify` on our deployment  
- Super-admin operations panel for wallet and anchor metrics  

We are **not** pointing production traffic at `webwallet.knuct.com` until Phase 0 is closed in writing.

Could you please:

1. Confirm receipt of this request  
2. Provide written answers to all 10 questions  
3. Share staging credentials and auth mechanism if available  
4. Propose a 30-minute technical walkthrough slot if helpful  

Thank you for your support. We look forward to a structured pilot once diligence is complete.

Best regards,  
[AIMSCS Integration Team]  
[Contact name]  
[Email]  
[Phone]

---

*Replace bracketed placeholders before sending. Full questionnaire: docs/KNUCT_Vendor_Questionnaire.md*
