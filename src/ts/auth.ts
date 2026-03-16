import { supabase } from './supabase';

type AuthMode = 'login' | 'signup';

const authMessage = document.getElementById('auth-message') as HTMLDivElement | null;
const googleLoginBtn = document.getElementById('google-login-btn') as HTMLButtonElement | null;

const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
const signupForm = document.getElementById('signup-form') as HTMLFormElement | null;

const showSignupBtn = document.getElementById('show-signup-btn') as HTMLButtonElement | null;
const showLoginBtn = document.getElementById('show-login-btn') as HTMLButtonElement | null;

// Универсальный хелпер для получения правильного пути
// Он объединит домен + /Rubaka-s.org/ + нужную страницу
const getRedirectUrl = (path: string) => {
  const baseUrl = import.meta.env.BASE_URL; // Это возьмет '/Rubaka-s.org/' из vite.config.ts
  const origin = window.location.origin;
  // Убираем лишние слеши при склейке
  return `${origin}${baseUrl}${path}`.replace(/\/+/g, '/').replace(':/', '://');
};

function setMessage(message: string, type: 'error' | 'success' | 'info' = 'info'): void {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.classList.remove('error', 'success');
  if (type === 'error') authMessage.classList.add('error');
  if (type === 'success') authMessage.classList.add('success');
}

function setMode(mode: AuthMode): void {
  if (!loginForm || !signupForm || !showSignupBtn || !showLoginBtn) return;

  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    showSignupBtn.classList.remove('hidden');
    showLoginBtn.classList.add('hidden');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    showSignupBtn.classList.add('hidden');
    showLoginBtn.classList.remove('hidden');
  }
}

async function signInWithGoogle(): Promise<void> {
  // ИСПРАВЛЕНО: Теперь редирект будет на правильный URL профиля
  const redirectTo = getRedirectUrl('pages/profile.html');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo
    }
  });

  if (error) {
    setMessage(error.message, 'error');
  }
}

async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setMessage('Could not sign in with these credentials.', 'error');
    return;
  }

  // ИСПРАВЛЕНО: Переход после логина
  window.location.href = getRedirectUrl('pages/profile.html');
}

async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    setMessage(error.message, 'error');
    return;
  }

  setMessage('Account created. Check your email if confirmation is enabled.', 'success');
}

async function redirectIfLoggedIn(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setMessage('Failed to check session.', 'error');
    return;
  }

  if (data.session) {
    // ИСПРАВЛЕНО: Редирект, если уже залогинен
    window.location.href = getRedirectUrl('pages/profile.html');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setMode('login');
  await redirectIfLoggedIn();

  showSignupBtn?.addEventListener('click', () => setMode('signup'));
  showLoginBtn?.addEventListener('click', () => setMode('login'));

  googleLoginBtn?.addEventListener('click', async () => {
    await signInWithGoogle();
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement | null;

    const email = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';

    if (!email || !password) {
      setMessage('Enter email and password.', 'error');
      return;
    }

    await signInWithPassword(email, password);
  });

  signupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('signup-email') as HTMLInputElement | null;
    const passwordInput = document.getElementById('signup-password') as HTMLInputElement | null;

    const email = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';

    if (!email || !password) {
      setMessage('Enter email and password.', 'error');
      return;
    }

    await signUp(email, password);
  });
});