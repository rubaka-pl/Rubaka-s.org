import { supabase } from './supabase';

export async function renderHeaderAuth(): Promise<void> {
  const authSlot = document.getElementById('auth-slot');
  if (!authSlot) return;

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Failed to get auth session:', error.message);
    return;
  }

  const session = data.session;
  
  const baseUrl = import.meta.env.BASE_URL; //  /Rubaka-s.org/
  const getPath = (page: string) => `${baseUrl}pages/${page}`.replace(/\/+/g, '/');

  if (!session?.user) {
    authSlot.innerHTML = `
      <a href="${getPath('login.html')}" class="header-login-link">Login</a>
    `;
    return;
  }

  const email = session.user.email ?? 'Profile';

  authSlot.innerHTML = `
  <div class="header-user">
    <a href="${getPath('profile.html')}" class="header-user-link" title="${email}">
      <span class="header-user-icon"></span>
      <span class="header-user-text">Your profile</span>
    </a>
  </div>
`;
}