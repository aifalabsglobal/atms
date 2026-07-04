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

**UI (super_admin):**

- Dashboard → **Run live pilot (5 users)**
- Settings → Knuct → **Run live pilot (5)**

**API:**

```http
POST /api/knuct/pilot
{ "sync": true, "limit": 5 }
```

Default cohort: registrar, HOD, faculty, two students.

## 4. Monitor

- Dashboard → Knuct Operations Center (live adapter badge, wallet counts)
- Users → Wallet column
- Settings → Knuct tab (health, mode)
- `GET /api/health` → `knuct.queue`, circuit state

## 5. Rollback

Set `KNUCT_ENABLED="false"` — SCMS continues normally; only new live provisioning stops.

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `createwallet` HTTP 500 | Confirm vendor base URL / API key; retry after `starttempnode` |
| Circuit open | Wait 60s or restart app; check `/api/health` |
| Wallet `failed` | Settings → Knuct shows `lastError`; retry from Users → Provision |
