# Reply to Knuct Team — Integration Status & Header Clarification

**To:** Kandala Meenakshi, Knuct / WebWallet Engineering  
**From:** AIMSCS Integration Team  
**Re:** Hybrid architecture confirmation, E2E validation, headers, CAPI, OpenCV, scaling  
**Demo URL:** https://atms-three.vercel.app

---

## 1. Hybrid architecture — implemented

We confirm the following is live in our Next.js application:

| Requirement | Implementation |
|-------------|----------------|
| Hash + NLSS in browser | `src/lib/knuct/priv-share.ts`, `nlss.ts`, `did-auth-panel.tsx` — private share image is **never uploaded** during auth |
| `/sapi/*` via backend proxy | `src/lib/knuct/knuct-client.ts` — all Knuct server calls from our API routes |
| Knuct session cookies server-side | Cookie jar on `KnuctHttpAdapter`; persisted in Redis/Upstash during multi-step auth |
| Verified DID in application DB | `KnuctWallet` table + `persistVerifiedDid()` after successful auth |

**Flow split (as you clarified):**

- **Wallet creation:** `GET /sapi/starttempnode` → `POST /sapi/createwallet` → privshare download  
- **DID login:** `POST /sapi/auth/challenge` → `POST /sapi/auth/response` → `GET /sapi/startnode` → `GET /sapi/walletdata`

---

## 2. E2E validation

We run an automated live test:

```bash
KNUCT_ENABLED=true npm run test:knuct:live
```

This script (`scripts/test-knuct-live.ts`) performs:

1. Wallet creation via `starttempnode`  
2. Privshare download  
3. Full DID auth chain (`challenge` → `response` → `startnode` → `walletdata`)  
4. **`GET /capi/getAccountInfo`** (with `/capi/start` retry on 409 if needed)

Manual UI path: Login → **Knuct DID** tab → upload privshare → sign in.

---

## 3. Header clarification (`KNUCT_API_KEY`)

We do **not** send an HTTP header named `KNUCT_API_KEY`.

`KNUCT_API_KEY` is our **environment variable** name only. When configured, our backend sends:

| Env variable | HTTP header |
|--------------|-------------|
| `KNUCT_API_KEY` | `X-Api-Key: {value}` |
| `KNUCT_TENANT_ID` | `X-Tenant-Id: {value}` |
| `KNUCT_API_SECRET` | `Authorization: Bearer {value}` |

These are optional for sandbox testing. Please confirm the official header names for production `/sapi/*` and `/capi/*` when staging credentials are issued.

---

## 4. CAPI integration

We have integrated (pending your full CAPI documentation):

| Endpoint | Status |
|----------|--------|
| `GET /capi/getAccountInfo` | Implemented — called after successful DID auth |
| `GET /capi/getDashboard` | Implemented — exposed via `GET /api/knuct/account` |
| `GET /capi/start` | Implemented — auto-retry on CAPI 409 |
| `GET /capi/check` | Implemented in adapter |

Post-auth Knuct session cookies are persisted per user (Redis when configured) so CAPI calls work after login without re-uploading the privshare.

---

## 5. OpenCV.js — mobile private share

Per your readme and shared build, we:

- Host vendor `opencv.js` at `/opencv.js` (`public/opencv.js`)
- Load OpenCV **only on mobile** user agents
- Use **Canvas API on desktop**, **OpenCV `cv.imread()` on mobile** (matching your `privShare.js` reference)

Files: `src/lib/knuct/opencv-loader.ts`, `priv-share.ts`, `device.ts`

---

## 6. Session scaling (production)

For development and initial validation we use in-memory fallback when Redis is unavailable. For production horizontal scaling on Vercel we persist:

- In-flight DID auth cookie jars → Upstash Redis (`knuct:did-auth:*`)
- Login grants → Upstash Redis (`knuct:login-grant:*`)
- Post-auth Knuct sessions → Upstash Redis (`knuct:user-session:*`)

We will enable Upstash in production before pilot scale-out.

---

## 7. Demo & next steps

- **Demo URL:** https://atms-three.vercel.app  
- **Screen recording:** [to be attached after live sandbox validation with `KNUCT_ENABLED=true`]

We welcome a short technical discussion after you review the demo. Please share the full CAPI documentation when available.

Regards,  
AIMSCS Integration Team
