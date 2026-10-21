import { createClient } from '@supabase/supabase-js';
import { RECONCILE_INTENT_STATUSES } from './holdings.js';

function unwrap(result, action) {
  if (result.error) {
    const error = new Error(`${action} failed`);
    error.cause = result.error.message;
    throw error;
  }
  return result.data;
}

export function createStore(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async strategies() {
      const rows = unwrap(await supabase.from('strategies').select('id, code, name'), 'load books');
      return new Map(rows.map((row) => [row.code, row]));
    },
    async controls() {
      const rows = unwrap(await supabase.from('controls').select('kill_switch').eq('id', 1), 'load kill switch');
      return rows[0] || null;
    },
    async startRun(row) {
      unwrap(await supabase.from('runs').insert(row), 'start run');
    },
    async finishRun(runId, patch) {
      unwrap(await supabase.from('runs').update(patch).eq('run_id', runId), 'finish run');
    },
    async acquireLock(sessionDate, runId) {
      const inserted = await supabase.from('run_locks').insert({ session_date: sessionDate, run_id: runId });
      if (!inserted.error) return true;
      if (inserted.error.code !== '23505') throw new Error('lock failed');
      const existing = unwrap(
        await supabase.from('run_locks').select('run_id, acquired_at, released_at').eq('session_date', sessionDate),
        'read lock',
      )[0];
      if (!existing) return false;
      const age = Date.now() - Date.parse(existing.acquired_at);
      if (!existing.released_at && age < 15 * 60 * 1000) return false;
      const updated = unwrap(
        await supabase.from('run_locks').update({
          run_id: runId,
          acquired_at: new Date().toISOString(),
          released_at: null,
        }).eq('session_date', sessionDate).eq('run_id', existing.run_id).select('run_id'),
        'take lock',
      );
      return updated[0]?.run_id === runId;
    },
    async releaseLock(sessionDate, runId) {
      unwrap(
        await supabase.from('run_locks').update({ released_at: new Date().toISOString() }).eq('session_date', sessionDate).eq('run_id', runId),
        'release lock',
      );
    },
    async bookState(strategyId) {
      const rows = unwrap(
        await supabase.from('book_state').select('positions, cooldown, opened').eq('strategy_id', strategyId),
        'load book state',
      );
      return rows[0] || { positions: [], cooldown: [], opened: false };
    },
    async saveBookState(strategyId, state) {
      unwrap(await supabase.from('book_state').upsert({
        strategy_id: strategyId,
        positions: state.positions,
        cooldown: state.cooldown,
        opened: state.opened,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'strategy_id' }), 'save book state');
    },
    async openIntents(strategyId) {
      return unwrap(
        await supabase.from('order_intents').select('*').eq('strategy_id', strategyId).in('status', [...RECONCILE_INTENT_STATUSES]),
        'load intents',
      );
    },
    async intents(strategyId) {
      return unwrap(
        await supabase.from('order_intents').select('*').eq('strategy_id', strategyId).order('session_date', { ascending: true }).order('id', { ascending: true }),
        'load intents',
      );
    },
    async quotesForSession(sessionDate) {
      return unwrap(
        await supabase.from('opening_quotes').select('id, symbol, bid, ask').eq('session_date', sessionDate),
        'load quotes',
      );
    },
    async upsertReason(row) {
      unwrap(await supabase.from('order_reasons').upsert(row, { onConflict: 'client_order_id' }), 'save reason');
    },
    async upsertIntent(row) {
      unwrap(await supabase.from('order_intents').upsert(row, { onConflict: 'client_order_id' }), 'save intent');
    },
    async upsertQuotes(rows) {
      if (rows.length === 0) return [];
      return unwrap(
        await supabase.from('opening_quotes').upsert(rows, { onConflict: 'session_date,symbol' }).select('id, symbol'),
        'save quotes',
      );
    },
    async upsertFillCost(row) {
      unwrap(await supabase.from('fill_spread_costs').upsert(row, { onConflict: 'client_order_id' }), 'save spread');
    },
    async saveSignals(row) {
      unwrap(await supabase.from('signal_snapshots').upsert(row, { onConflict: 'strategy_id,session_date' }), 'save signals');
    },
    async alert(row) {
      unwrap(await supabase.from('alerts').insert(row), 'save alert');
    },
  };
}
