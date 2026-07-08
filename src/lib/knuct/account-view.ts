/** Best-effort parsing of Knuct CAPI getAccountInfo / getDashboard for UI display. */

export type KnuctTokenRow = {
  id: string;
  name: string;
  symbol?: string;
  balance?: string;
  type?: string;
};

export type KnuctAccountView = {
  did?: string;
  balance?: string;
  currency?: string;
  tokens: KnuctTokenRow[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && v !== '') return String(v);
  }
  return undefined;
}

function extractTokenRows(raw: unknown): KnuctTokenRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: KnuctTokenRow[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    rows.push({
      id: String(row.id ?? row.symbol ?? row.name ?? rows.length),
      name: String(row.name ?? row.symbol ?? row.token ?? 'Token'),
      symbol: row.symbol ? String(row.symbol) : undefined,
      balance: pickString(row, ['balance', 'amount', 'value', 'quantity', 'count']),
      type: row.type ? String(row.type) : undefined,
    });
  }
  return rows;
}

/** Normalize vendor CAPI payloads into balance + token rows for the wallet UI. */
export function parseKnuctAccountView(accountInfo: unknown, dashboard?: unknown): KnuctAccountView {
  const account = asRecord(accountInfo) ?? {};
  const dash = asRecord(dashboard) ?? {};
  const nested = asRecord(account.data) ?? asRecord(account.account) ?? {};

  const balance =
    pickString(account, ['balance', 'availableBalance', 'totalBalance', 'walletBalance']) ??
    pickString(nested, ['balance', 'availableBalance', 'totalBalance']) ??
    pickString(dash, ['balance', 'totalBalance']);

  const currency =
    pickString(account, ['currency', 'unit']) ??
    pickString(nested, ['currency', 'unit']);

  const did =
    pickString(account, ['did', 'DID']) ??
    pickString(nested, ['did', 'DID']);

  let tokens = extractTokenRows(
    account.tokens ??
      account.assets ??
      account.balances ??
      nested.tokens ??
      nested.assets ??
      dash.tokens ??
      dash.assets
  );

  if (tokens.length === 0 && balance) {
    tokens = [{ id: 'primary', name: 'Wallet balance', balance, symbol: currency }];
  }

  return { did, balance, currency, tokens };
}
