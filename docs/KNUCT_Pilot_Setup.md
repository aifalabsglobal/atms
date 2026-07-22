# Knuct Live Pilot Setup

## 1. Enable in `.env`

```env
KNUCT_ENABLED="true"
KNUCT_BASE_URL="https://webwallet.knuct.com"
KNUCT_WALLET_ON_USER_CREATE="false"
KNUCT_PRIVSHARE_ENC_KEY="<64-char-hex>"
KNUCT_ANCHOR_ENABLED="true"
KNUCT_PILOT_COHORT_LIMIT="25"
```

If Knuct provided credentials, also set:

```env
KNUCT_API_KEY="..."
KNUCT_API_SECRET="..."
KNUCT_TENANT_ID="..."
```

## 2. Verify connectivity

```bash
npm run test:knuct:live
```

Expected: `startTempNode` → 204, `createWallet` → 200 with nested `{ data: { did, privshare } }`, privshare download via `/sapi/privshare?k=...`.

**Note:** Vendor API expects lowercase `seedWords` (e.g. `["hill","parrot","zebra","cat"]`).

## 3. Run pilot cohort

**CLI (sync, default demo emails):**

```bash
npm run knuct:pilot:sync
```

**UI (Knuct console operators only):**

1. Grant ops access: `npx tsx scripts/grant-knuct-console-access.ts vice.chancellor@aimscs.ac.in`
2. Open `/knuct/login` → **Ops password** (not campus `/login`)
3. Use **Run live pilot (5)** on the Knuct console dashboard

Campus ATMS roles never see Knuct UI. Blockchain anchors still run server-side from attendance/LMS APIs.

**API:**

```http
POST /api/knuct/pilot
{ "sync": true, "limit": 5 }
```

Default cohort: registrar, HOD, faculty, two students.

## 4. Monitor

- `/knuct` ops dashboard (adapter health, wallet counts, anchors)
- `GET /api/health` → `knuct.queue`, circuit state

## 5. Rollback

Set `KNUCT_ENABLED="false"` — SCMS continues normally; only new live provisioning stops.

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `createwallet` HTTP 500 | Confirm vendor base URL / API key; retry after `starttempnode` |
| Circuit open | Wait 60s or restart app; check `/api/health` |
| Wallet `failed` | `/knuct` wallet panel shows `lastError`; retry from ops queues |
| Campus login shows no DID | Expected — use `/knuct/login` |
| Ops password rejected | Run `npx tsx scripts/grant-knuct-console-access.ts <email>` |
