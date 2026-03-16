import { supabase } from './supabase';
import { syncCurrentUserDailyStreak } from './userProgress';

interface ProfileRow {
  id: string;
  email: string | null;
  nickname: string | null;
  joined_at: string | null;
  total_xp: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  last_login_date?: string | null;
  avatar_url?: string | null;
}

interface RecentGameRow {
  id: string;
  user_id: string;
  game_slug: string;
  game_title: string;
  duration_minutes: number;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
}

interface TopGameRow {
  game_slug: string;
  game_title: string;
  total_minutes: number;
  total_seconds: number;
  sessions_count: number;
  last_played_at: string;
}

const profileNickname = document.getElementById('profile-nickname') as HTMLHeadingElement | null;
const profileEmail = document.getElementById('profile-email') as HTMLParagraphElement | null;
const profileJoined = document.getElementById('profile-joined') as HTMLParagraphElement | null;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement | null;

const nicknameForm = document.getElementById('nickname-form') as HTMLFormElement | null;
const nicknameInput = document.getElementById('nickname-input') as HTMLInputElement | null;

const changeAvatarBtn = document.getElementById('change-avatar-btn') as HTMLButtonElement | null;
const avatarInput = document.getElementById('avatar-input') as HTMLInputElement | null;
const profileAvatarImage = document.getElementById('profile-avatar-image') as HTMLImageElement | null;

const profileLevel = document.getElementById('profile-level') as HTMLSpanElement | null;
const profileTotalXp = document.getElementById('profile-total-xp') as HTMLParagraphElement | null;
const profileNextLevel = document.getElementById('profile-next-level') as HTMLParagraphElement | null;
const xpBarFill = document.getElementById('xp-bar-fill') as HTMLDivElement | null;

const statTimePlayed = document.getElementById('stat-time-played') as HTMLSpanElement | null;
const statGamesPlayed = document.getElementById('stat-games-played') as HTMLSpanElement | null;
const statCurrentStreak = document.getElementById('stat-current-streak') as HTMLSpanElement | null;
const statLongestStreak = document.getElementById('stat-longest-streak') as HTMLSpanElement | null;

const recentActivityList = document.getElementById('recent-activity-list') as HTMLDivElement | null;
const topGamesList = document.getElementById('top-games-list') as HTMLDivElement | null;

const dailyCheckinBtn = document.getElementById('daily-checkin-btn') as HTMLButtonElement | null;
const dailyCheckinStatus = document.getElementById('daily-checkin-status') as HTMLDivElement | null;

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE_MB = 2;
const DEFAULT_AVATAR_URL = '/assets/avatar.png';
const RECENT_ACTIVITY_LIMIT = 3;

function getTodayUtcDate(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB');
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (seconds === 0) return `${minutes} min`;
    return `${minutes} min ${seconds} sec`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const minutes = Math.floor(remainingSeconds / 60);

  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function getXpRequiredForLevel(level: number): number {
  if (level < 20) return 100;
  if (level < 40) return 300;
  return 600;
}

function calculateLevelInfo(totalXp: number) {
  let level = 1;
  let remainingXp = totalXp;

  while (remainingXp >= getXpRequiredForLevel(level)) {
    remainingXp -= getXpRequiredForLevel(level);
    level += 1;
  }

  const xpForCurrentLevel = getXpRequiredForLevel(level);
  const progressPercent = Math.min((remainingXp / xpForCurrentLevel) * 100, 100);

  return {
    level,
    currentLevelXp: remainingXp,
    xpForCurrentLevel,
    xpToNextLevel: xpForCurrentLevel - remainingXp,
    progressPercent,
  };
}

function updateDailyCheckinUi(lastLoginDate: string | null | undefined): void {
  if (!dailyCheckinBtn || !dailyCheckinStatus) return;

  const today = getTodayUtcDate();
  const alreadyClaimedToday = lastLoginDate === today;

  if (alreadyClaimedToday) {
    dailyCheckinStatus.textContent = '✅ Today has already been added to your streak.';
    dailyCheckinBtn.disabled = true;
    dailyCheckinBtn.textContent = 'Claimed';
  } else {
    dailyCheckinStatus.textContent = '🔥 Ready to claim today’s reward.';
    dailyCheckinBtn.disabled = false;
    dailyCheckinBtn.textContent = 'Claim Daily Streak';
  }
}

async function loadProfile(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    window.location.href = './pages/login.html';
    return null;
  }

  const user = data.user;
  const fallbackNickname = user.email?.split('@')[0] ?? 'Player';

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    console.error('Failed to load profile:', profileError.message);
  }

  const nickname = profileData?.nickname || fallbackNickname;
  const totalXp = profileData?.total_xp ?? 0;
  const currentStreak = profileData?.current_streak ?? 0;
  const longestStreak = profileData?.longest_streak ?? 0;
  const joinedAt = profileData?.joined_at ?? user.created_at ?? null;
  const avatarUrl = profileData?.avatar_url ?? null;

  if (profileNickname) profileNickname.textContent = nickname;
  if (profileEmail) profileEmail.textContent = user.email ?? 'No email';
  if (profileJoined) profileJoined.textContent = `Joined ${formatDate(joinedAt)}`;
  if (nicknameInput) nicknameInput.value = profileData?.nickname ?? '';

  if (profileAvatarImage) {
    profileAvatarImage.src = avatarUrl
      ? `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
      : DEFAULT_AVATAR_URL;
  }

  updateDailyCheckinUi(profileData?.last_login_date);

  const levelInfo = calculateLevelInfo(totalXp);

  if (profileLevel) profileLevel.textContent = String(levelInfo.level);
  if (profileTotalXp) profileTotalXp.textContent = `${totalXp} XP`;
  if (profileNextLevel) profileNextLevel.textContent = `${levelInfo.xpToNextLevel} XP to next level`;
  if (xpBarFill) xpBarFill.style.width = `${levelInfo.progressPercent}%`;

  if (statCurrentStreak) statCurrentStreak.textContent = String(currentStreak);
  if (statLongestStreak) statLongestStreak.textContent = String(longestStreak);

  return user.id;
}

async function loadRecentActivity(userId: string): Promise<void> {
  if (!recentActivityList) return;

  recentActivityList.innerHTML = `<p class="empty-state">Loading...</p>`;

  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, user_id, game_slug, game_title, duration_minutes, duration_seconds, started_at, ended_at')
    .eq('user_id', userId)
    .gt('duration_seconds', 0)
    .order('started_at', { ascending: false })
    .limit(RECENT_ACTIVITY_LIMIT);

  if (error) {
    console.error('Recent activity error:', error);
    recentActivityList.innerHTML = `<p class="empty-state">Failed to load recent activity.</p>`;
    return;
  }

  const rows = (data ?? []) as RecentGameRow[];

  if (rows.length === 0) {
    recentActivityList.innerHTML = `<p class="empty-state">No recent activity yet.</p>`;
    return;
  }

  recentActivityList.innerHTML = rows.map((row) => `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="recent-game-title">${row.game_title}</span>
        <span class="recent-game-meta">
          Played ${formatDuration(row.duration_seconds ?? 0)} • ${formatDate(row.started_at)}${row.ended_at ? '' : ' • Playing now'}
        </span>
      </div>
      <a href="/index.html?game=${encodeURIComponent(row.game_slug)}" class="btn">Open</a>
    </div>
  `).join('');
}

async function loadTopGames(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_game_stats')
    .select('game_slug, game_title, total_minutes, total_seconds, sessions_count, last_played_at')
    .eq('user_id', userId)
    .order('total_seconds', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Failed to load top games:', error.message);
  }

  const rows = (data ?? []) as TopGameRow[];

  if (!topGamesList) return;

  if (rows.length === 0) {
    topGamesList.innerHTML = `<p class="empty-state">No game stats yet.</p>`;
    if (statTimePlayed) statTimePlayed.textContent = '0 sec';
    if (statGamesPlayed) statGamesPlayed.textContent = '0';
    return;
  }

  const totalSeconds = rows.reduce((sum, row) => sum + (row.total_seconds ?? 0), 0);

  if (statTimePlayed) statTimePlayed.textContent = formatDuration(totalSeconds);
  if (statGamesPlayed) statGamesPlayed.textContent = String(rows.length);

  topGamesList.innerHTML = rows
    .map((row) => {
      return `
        <div class="recent-item">
          <div class="recent-item-left">
            <span class="recent-game-title">${row.game_title}</span>
            <span class="recent-game-meta">${formatDuration(row.total_seconds ?? 0)} • ${row.sessions_count} sessions</span>
          </div>
          <a href="/index.html?game=${encodeURIComponent(row.game_slug)}" class="btn">Open</a>
        </div>
      `;
    })
    .join('');
}

async function saveNickname(userId: string, nickname: string): Promise<void> {
  const trimmedNickname = nickname.trim();

  const { data: currentProfile, error: loadError } = await supabase
    .from('profiles')
    .select('id, email, joined_at, total_xp, current_streak, longest_streak, last_login_date, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (loadError) {
    console.error('Failed to load current profile before saving nickname:', loadError.message);
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: currentProfile?.email ?? null,
      joined_at: currentProfile?.joined_at ?? new Date().toISOString(),
      total_xp: currentProfile?.total_xp ?? 0,
      current_streak: currentProfile?.current_streak ?? 0,
      longest_streak: currentProfile?.longest_streak ?? 0,
      last_login_date: currentProfile?.last_login_date ?? null,
      avatar_url: currentProfile?.avatar_url ?? null,
      nickname: trimmedNickname || null,
    });

  if (error) {
    console.error('Failed to save nickname:', error.message);
    return;
  }

  if (profileNickname) {
    profileNickname.textContent = trimmedNickname || 'Player';
  }

  if (nicknameInput) {
    nicknameInput.value = trimmedNickname;
  }
}

async function uploadAvatar(userId: string, file: File): Promise<void> {
  if (!profileAvatarImage) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const maxBytes = MAX_AVATAR_SIZE_MB * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    alert('Only PNG, JPG, WEBP or GIF files are allowed.');
    return;
  }

  if (file.size > maxBytes) {
    alert(`File is too large. Max size is ${MAX_AVATAR_SIZE_MB} MB.`);
    return;
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `${userId}/avatar.${fileExt}`;

  const localPreviewUrl = URL.createObjectURL(file);
  profileAvatarImage.src = localPreviewUrl;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error('Failed to upload avatar:', uploadError);
    alert('Failed to upload avatar.');
    profileAvatarImage.src = DEFAULT_AVATAR_URL;
    URL.revokeObjectURL(localPreviewUrl);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath);

  const cleanAvatarUrl = publicUrlData.publicUrl;
  const displayAvatarUrl = `${cleanAvatarUrl}?v=${Date.now()}`;

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      avatar_url: cleanAvatarUrl,
    })
    .eq('id', userId);

  if (profileUpdateError) {
    console.error('Failed to save avatar_url to profile:', profileUpdateError);
    alert('Avatar was uploaded, but profile was not updated.');
    URL.revokeObjectURL(localPreviewUrl);
    return;
  }

  profileAvatarImage.src = displayAvatarUrl;
  URL.revokeObjectURL(localPreviewUrl);
}

async function claimDailyCheckin(): Promise<void> {
  if (!dailyCheckinBtn || !dailyCheckinStatus) return;

  dailyCheckinBtn.disabled = true;
  dailyCheckinStatus.textContent = 'Claiming daily streak...';

  await syncCurrentUserDailyStreak();

  const userId = await loadProfile();
  if (!userId) return;

  await loadTopGames(userId);
  await loadRecentActivity(userId);

  const { data: refreshedProfile, error } = await supabase
    .from('profiles')
    .select('last_login_date')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to refresh daily check-in status:', error.message);
  }

  updateDailyCheckinUi(refreshedProfile?.last_login_date ?? null);
}

async function logout(): Promise<void> {
  await supabase.auth.signOut();
  window.location.href = './pages/login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await syncCurrentUserDailyStreak();

  const userId = await loadProfile();
  if (!userId) return;

  await loadRecentActivity(userId);
  await loadTopGames(userId);

  nicknameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nickname = nicknameInput?.value ?? '';
    await saveNickname(userId, nickname);
  });

  changeAvatarBtn?.addEventListener('click', () => {
    avatarInput?.click();
  });

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;

    await uploadAvatar(userId, file);
    avatarInput.value = '';
  });

  dailyCheckinBtn?.addEventListener('click', async () => {
    await claimDailyCheckin();
  });

  logoutBtn?.addEventListener('click', logout);
});