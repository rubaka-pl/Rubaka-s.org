import { supabase } from './supabase';
import type { Game } from './types';

const XP_PER_MINUTE = 5;

interface SessionProgressRow {
  id: string;
  user_id: string;
  credited_seconds: number | null;
  duration_seconds: number | null;
}

interface UserGameStatsRow {
  id: string;
  total_seconds: number | null;
  total_minutes: number | null;
  sessions_count: number | null;
}

function getTodayUtcDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayUtcDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
}

function getStreakBonusXp(streak: number): number {
  return Math.min(20 + (streak - 1) * 5, 100);
}

function getDurationSeconds(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function secondsToMinutes(totalSeconds: number): number {
  return Math.floor(totalSeconds / 60);
}

function getTotalXpForPlayedSeconds(totalSeconds: number): number {
  return Math.floor((totalSeconds * XP_PER_MINUTE) / 60);
}

/**
 * ----------------------------------------
 * DAILY STREAK
 * ----------------------------------------
 */
export async function syncCurrentUserDailyStreak(): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return;
  }

  const user = authData.user;
  const today = getTodayUtcDate();
  const yesterday = getYesterdayUtcDate();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, nickname, joined_at, total_xp, current_streak, longest_streak, last_login_date')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const initialStreak = 1;
    const bonusXp = getStreakBonusXp(initialStreak);

    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? null,
      joined_at: user.created_at ?? new Date().toISOString(),
      total_xp: bonusXp,
      current_streak: initialStreak,
      longest_streak: initialStreak,
      last_login_date: today,
    });

    return;
  }

  if (profile.last_login_date === today) {
    return;
  }

  let nextStreak = 1;

  if (profile.last_login_date === yesterday) {
    nextStreak = (profile.current_streak ?? 0) + 1;
  }

  const bonusXp = getStreakBonusXp(nextStreak);
  const totalXp = (profile.total_xp ?? 0) + bonusXp;
  const longestStreak = Math.max(profile.longest_streak ?? 0, nextStreak);

  await supabase
    .from('profiles')
    .update({
      current_streak: nextStreak,
      longest_streak: longestStreak,
      total_xp: totalXp,
      last_login_date: today,
    })
    .eq('id', user.id);
}

/**
 * ----------------------------------------
 * START GAME SESSION
 * ----------------------------------------
 * Создаёт новую игровую сессию и сразу
 * увеличивает sessions_count для этой игры.
 * ----------------------------------------
 */
export async function startCurrentUserGameSession(
  game: Game,
  startedAt: number
): Promise<string | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error('[SESSION] auth error on start', authError);
    return null;
  }

  if (!authData.user) {
    console.warn('[SESSION] no user on start');
    return null;
  }

  const user = authData.user;
  const startedIso = new Date(startedAt).toISOString();
  const nowIso = new Date().toISOString();

  const { data: sessionData, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      user_id: user.id,
      game_slug: game.slug,
      game_title: game.title,
      duration_minutes: 0,
      duration_seconds: 0,
      credited_seconds: 0,
      started_at: startedIso,
      ended_at: null,
    })
    .select('id')
    .single();

  if (sessionError) {
    console.error('[SESSION] failed to start', sessionError);
    return null;
  }

  const { data: existingStats, error: statsLoadError } = await supabase
    .from('user_game_stats')
    .select('id, total_seconds, total_minutes, sessions_count')
    .eq('user_id', user.id)
    .eq('game_slug', game.slug)
    .maybeSingle<UserGameStatsRow>();

  if (statsLoadError) {
    console.error('[SESSION] failed to load stats on start', statsLoadError);
  } else if (existingStats) {
    const { error: statsUpdateError } = await supabase
      .from('user_game_stats')
      .update({
        game_title: game.title,
        sessions_count: (existingStats.sessions_count ?? 0) + 1,
        last_played_at: nowIso,
      })
      .eq('id', existingStats.id);

    if (statsUpdateError) {
      console.error('[SESSION] failed to update stats on start', statsUpdateError);
    }
  } else {
    const { error: statsInsertError } = await supabase
      .from('user_game_stats')
      .insert({
        user_id: user.id,
        game_slug: game.slug,
        game_title: game.title,
        total_seconds: 0,
        total_minutes: 0,
        sessions_count: 1,
        last_played_at: nowIso,
      });

    if (statsInsertError) {
      console.error('[SESSION] failed to insert stats on start', statsInsertError);
    }
  }

  console.log('[SESSION] started', sessionData.id);
  return sessionData.id as string;
}

/**
 * ----------------------------------------
 * HEARTBEAT GAME SESSION
 * ----------------------------------------
 * Каждые 10 секунд:
 * - обновляет текущую сессию
 * - добавляет новые секунды в user_game_stats
 * - начисляет XP за новые секунды
 * - обновляет credited_seconds, чтобы не было дублей
 * ----------------------------------------
 */
export async function heartbeatCurrentUserGameSession(
  sessionId: string,
  game: Game,
  startedAt: number
): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error('[SESSION] auth error on heartbeat', authError);
    return;
  }

  if (!authData.user) {
    console.warn('[SESSION] no user on heartbeat');
    return;
  }

  const user = authData.user;
  const nowIso = new Date().toISOString();
  const totalSeconds = getDurationSeconds(startedAt);
  const totalMinutes = secondsToMinutes(totalSeconds);

  const { data: session, error: sessionLoadError } = await supabase
    .from('game_sessions')
    .select('id, user_id, credited_seconds, duration_seconds')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle<SessionProgressRow>();

  if (sessionLoadError || !session) {
    console.error('[SESSION] failed to load current session', sessionLoadError);
    return;
  }

  const creditedSeconds = session.credited_seconds ?? 0;
  const deltaSeconds = totalSeconds - creditedSeconds;

  const { error: sessionUpdateError } = await supabase
    .from('game_sessions')
    .update({
      duration_seconds: totalSeconds,
      duration_minutes: totalMinutes,
      ended_at: nowIso,
    })
    .eq('id', sessionId);

  if (sessionUpdateError) {
    console.error('[SESSION] failed to update heartbeat session', sessionUpdateError);
    return;
  }

  if (deltaSeconds <= 0) {
    return;
  }

  const { data: existingStats, error: statsLoadError } = await supabase
    .from('user_game_stats')
    .select('id, total_seconds, total_minutes, sessions_count')
    .eq('user_id', user.id)
    .eq('game_slug', game.slug)
    .maybeSingle<UserGameStatsRow>();

  if (statsLoadError) {
    console.error('[SESSION] failed to load stats on heartbeat', statsLoadError);
    return;
  }

  if (existingStats) {
    const nextTotalSeconds = (existingStats.total_seconds ?? 0) + deltaSeconds;

    const { error: statsUpdateError } = await supabase
      .from('user_game_stats')
      .update({
        game_title: game.title,
        total_seconds: nextTotalSeconds,
        total_minutes: secondsToMinutes(nextTotalSeconds),
        last_played_at: nowIso,
      })
      .eq('id', existingStats.id);

    if (statsUpdateError) {
      console.error('[SESSION] failed to update stats on heartbeat', statsUpdateError);
      return;
    }
  } else {
    const { error: statsInsertError } = await supabase
      .from('user_game_stats')
      .insert({
        user_id: user.id,
        game_slug: game.slug,
        game_title: game.title,
        total_seconds: deltaSeconds,
        total_minutes: secondsToMinutes(deltaSeconds),
        sessions_count: 1,
        last_played_at: nowIso,
      });

    if (statsInsertError) {
      console.error('[SESSION] failed to insert stats on heartbeat', statsInsertError);
      return;
    }
  }

  const totalXpEarnedNow = getTotalXpForPlayedSeconds(totalSeconds);
  const totalXpEarnedBefore = getTotalXpForPlayedSeconds(creditedSeconds);
  const deltaXp = totalXpEarnedNow - totalXpEarnedBefore;

  if (deltaXp > 0) {
    const { data: profile, error: profileLoadError } = await supabase
      .from('profiles')
      .select('id, total_xp')
      .eq('id', user.id)
      .maybeSingle();

    if (profileLoadError) {
      console.error('[SESSION] failed to load profile on heartbeat', profileLoadError);
      return;
    }

    const { error: xpUpdateError } = await supabase
      .from('profiles')
      .update({
        total_xp: (profile?.total_xp ?? 0) + deltaXp,
      })
      .eq('id', user.id);

    if (xpUpdateError) {
      console.error('[SESSION] failed to update xp on heartbeat', xpUpdateError);
      return;
    }
  }

  const { error: creditUpdateError } = await supabase
    .from('game_sessions')
    .update({
      credited_seconds: totalSeconds,
      ended_at: nowIso,
    })
    .eq('id', sessionId);

  if (creditUpdateError) {
    console.error('[SESSION] failed to update credited seconds', creditUpdateError);
  }
}

/**
 * ----------------------------------------
 * FINISH GAME SESSION
 * ----------------------------------------
 * Финальный вызов перед закрытием:
 * - добивает последний heartbeat
 * - ставит ended_at
 * ----------------------------------------
 */
export async function finishCurrentUserGameSession(
  sessionId: string,
  game: Game,
  startedAt: number
): Promise<void> {
  await heartbeatCurrentUserGameSession(sessionId, game, startedAt);

  const endedIso = new Date().toISOString();

  const { error } = await supabase
    .from('game_sessions')
    .update({
      ended_at: endedIso,
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[SESSION] failed to finalize session', error);
  } else {
    console.log('[SESSION] finalized', sessionId);
  }
}