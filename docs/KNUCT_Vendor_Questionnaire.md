# Knuct Vendor Diligence Questionnaire (Phase 0)

**From:** AIMSCS Integration Team  
**To:** Knuct / WebWallet vendor contact  
**Re:** Pre-production integration for campus decentralized identity & audit anchoring  
**Date:** June 2026

---

## Context

AIMSCS is evaluating Knuct as an optional third-party layer for:

1. **Wallet + DID provisioning** per user (Phase 1 — implemented in mock mode)
2. **Hash-only audit anchoring** for attendance, grades, violations (Phase 3 — implemented; chain publish pending your API)
3. **Verifiable credentials** for attendance certificates and grade transcripts (Phase 2 — blocked on your cert APIs)

We have integrated against the documented sandbox at `https://webwallet.knuct.com` using an internal adapter pattern. **We are not pointing production traffic at the sandbox** until the questions below are answered in writing.

Please respond to **all 10 items** below. Written answers (email or PDF) close Phase 0 and unlock a bounded pilot cohort.

---

## Questions

### 1. Private share format
What is the exact format of the downloaded privshare (binary blob, image, JSON, other)?  
Please provide a sample Content-Type and byte-length range.

### 2. Certificate / credential APIs
What are the API endpoints for:
- Minting an asset/certificate token
- Publishing to chain or IPFS
- Public verification (third-party verifier without SCMS login)

Please share request/response JSON schemas.

### 3. Production authentication & tenancy
Is there an API key, bearer token, or tenant ID for multi-client production use?  
How is tenant isolation enforced between institutions?

### 4. Error codes & retry semantics
What are documented error codes and safe retry semantics?  
The current docs warn against retrying some steps — please clarify which operations are idempotent.

### 5. `starttempnode` scaling model
Can one `starttempnode` instance serve multiple wallet creations, or is it strictly 1:1 per user?  
What is the recommended reuse pattern for batch onboarding?

### 6. Campus-scale cost & concurrency
What is the cost/concurrency model for onboarding 1,000+ students?  
Are there rate limits on the sandbox vs production tier?

### 7. DID interoperability
Is there a W3C-conformant DID Document / resolver, or is the returned CID the entire identity artifact?  
If not W3C-native, is a resolver roadmap published?

### 8. Data residency & DPDP (India)
Where is `webwallet.knuct.com` hosted (region, cloud provider)?  
Is a Data Processing Agreement available for student-data handling under India's DPDP Act 2023?

### 9. Dedicated staging tenant
Is there a dedicated staging/sandbox tenant separate from the shared public dev environment?  
Can AIMSCS receive isolated credentials for integration testing?

### 10. Passphrase & privshare lifecycle
After privshare download, is the wallet passphrase still required for future operations?  
Should SCMS persist the passphrase encrypted alongside the privshare, or only the privshare?

---

## What we need to proceed

| Deliverable | Unblocks |
|-------------|----------|
| Written answers to Q1–Q10 | Phase 0 sign-off |
| Staging tenant + auth credentials | Live pilot (`KNUCT_ENABLED=true`) |
| Cert mint/verify API docs | Phase 2 verifiable credentials |
| Chain publish API for hash anchors | Knuct chain publish (currently hash-only in PostgreSQL) |
| DPA / hosting confirmation | Production rollout beyond pilot |

---

## Our current integration (for reference)

- **Adapter:** `src/lib/knuct/` (live when `KNUCT_ENABLED=true`)
- **Wallet provisioning:** `POST /api/knuct` — async queue, circuit breaker, encrypted privshare at rest
- **Anchors:** SHA-256 hashes in PostgreSQL; optional chain publish when vendor URL is supplied (see below)
- **Credentials:** `POST /api/knuct/credentials` — hash + mint queue ready; live mint blocked until Q2 schemas
- **Privshare:** AES-256-GCM encrypted at rest; key in `KNUCT_PRIVSHARE_ENC_KEY`
- **Pilot scope:** Single college / single cohort; reversible; PostgreSQL remains system of record

### SCMS is ready to enable (env-only — no code changes needed)

Once you provide API URLs and auth, we will set:

| Env variable | Purpose | Expected vendor contract |
|--------------|---------|-------------------------|
| `KNUCT_CHAIN_PUBLISH_ENABLED=true` | Turn on chain publish | — |
| `KNUCT_CHAIN_PUBLISH_URL` | `POST` hash anchor | Body: `{ resourceType, resourceId, payloadHash, tenantId? }` → `{ txRef \| txHash }` |
| `KNUCT_CREDENTIALS_ENABLED=true` | Turn on credential flow | — |
| `KNUCT_CREDENTIAL_MINT_URL` | `POST` mint certificate | Body: `{ userId, did?, credentialType, payloadHash, resourceId?, metadata? }` → `{ assetRef, verifyUrl? }` |
| `KNUCT_CREDENTIAL_VERIFY_URL` | Public verify template | URL with `{assetRef}` placeholder or path suffix |
| `KNUCT_API_KEY` / `KNUCT_TENANT_ID` | Production auth | Sent as `Authorization: Bearer` and `X-Knuct-Tenant-Id` |

**Adapter files:** `chain-publish.ts`, `credential-client.ts`, `vendor-http.ts`  
**Public verify:** `/verify?hash=…` (hash lookup) — credential verify URL from vendor when available.

Please reply to the technical contact on this integration. We can schedule a 30-minute walkthrough of our adapter and super_admin operations panel on request.

---

*Derived from KNUCT_SCMS_Integration_Report.md Section 14.*
