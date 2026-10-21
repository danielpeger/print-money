const KEY_NAMES = [
  'APCA_API_KEY_ID_TREND',
  'APCA_API_SECRET_KEY_TREND',
  'APCA_API_KEY_ID_DIP',
  'APCA_API_SECRET_KEY_DIP',
  'APCA_API_KEY_ID_CONTROL',
  'APCA_API_SECRET_KEY_CONTROL',
];

export function missingKeyNames(env) {
  return KEY_NAMES.filter((name) => !env[name]);
}

export function assertPaperEnv(env) {
  const missing = missingKeyNames(env);
  if (missing.length > 0) {
    const error = new Error(`Missing Alpaca variables: ${missing.join(', ')}`);
    error.code = 'missing_keys';
    throw error;
  }
  const base = env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets/v2';
  if (!base.startsWith('https://paper-api.alpaca.markets')) {
    const error = new Error('This deployment only submits Alpaca paper orders.');
    error.code = 'live_refused';
    throw error;
  }
  if (env.ALPACA_PAPER === 'false' && env.LIVE_TRADING_APPROVED !== 'yes') {
    const error = new Error('Live mode was requested without deployment approval.');
    error.code = 'live_refused';
    throw error;
  }
  if (env.ALPACA_PAPER === 'false') {
    const error = new Error('This deployment never submits live orders.');
    error.code = 'live_refused';
    throw error;
  }
}

export function checkAccount(account) {
  if (!account || account.equity == null || account.cash == null) {
    return { ok: false, reason: 'account_unavailable' };
  }
  if (!Array.isArray(account.positions) || !Array.isArray(account.openOrders)) {
    return { ok: false, reason: 'account_unavailable' };
  }
  return { ok: true };
}

export function checkDataFresh(latestBarDate, sessionDate) {
  if (!latestBarDate || latestBarDate !== sessionDate) {
    return { ok: false, reason: 'stale_bars', latestBarDate, sessionDate };
  }
  return { ok: true };
}

/**
 * No new leverage. A leftover cash hole from a prior fill may already make
 * position value slightly larger than equity. Holding or a cash-neutral swap
 * is allowed. Adding net long dollars beyond the current book is not.
 */
export function checkExposure({ equity, positionValue, buyNotional, sellNotional }) {
  if (!(equity > 0)) return { ok: false, reason: 'equity_unavailable' };
  if (buyNotional < 0 || sellNotional < 0 || positionValue < 0) {
    return { ok: false, reason: 'negative_order' };
  }
  const next = positionValue + buyNotional - sellNotional;
  const cap = Math.max(equity, positionValue) * 1.0001;
  if (next > cap) return { ok: false, reason: 'exposure', exposure: next / equity, next, cap };
  return { ok: true, exposure: next / equity };
}

export function exposureMessage(code, exposure) {
  if (exposure?.reason === 'equity_unavailable') return `exposure check failed for ${code}: equity unavailable`;
  if (exposure?.reason === 'negative_order') return `exposure check failed for ${code}: negative order`;
  return `exposure check failed for ${code}`;
}

export function inferredCash(account) {
  if (account && Number.isFinite(Number(account.cash))) return Number(account.cash);
  const equity = Number(account?.equity);
  const marked = (account?.positions || []).reduce((sum, position) => {
    const value = Number(position.market_value);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  if (Number.isFinite(equity)) return equity - marked;
  return 0;
}

export function killSwitchOn(env, controls) {
  if (env.KILL_SWITCH === 'true' || env.KILL_SWITCH === '1') return true;
  return Boolean(controls && controls.kill_switch);
}
