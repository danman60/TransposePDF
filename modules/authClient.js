/** Auth/team facade over an injected Supabase client. No project credentials live here. */
class AuthClient {
  constructor(supabaseClient) {
    if (!supabaseClient?.auth) throw new Error('An initialized Supabase client is required');
    this.client = supabaseClient;
    this.listeners = new Set();
    this.subscription = null;
  }

  async initialize() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    const result = this.client.auth.onAuthStateChange((event, session) => this.notify(event, session));
    this.subscription = result?.data?.subscription || result?.subscription || null;
    this.notify('INITIAL_SESSION', data?.session || null);
    return data?.session || null;
  }

  async signInWithEmail(email, { redirectTo } = {}) {
    const options = redirectTo ? { emailRedirectTo: redirectTo } : undefined;
    const { data, error } = await this.client.auth.signInWithOtp({ email: String(email).trim(), options });
    if (error) throw error;
    return data;
  }

  async signInWithGoogle({ redirectTo } = {}) {
    const options = redirectTo ? { redirectTo } : undefined;
    const { data, error } = await this.client.auth.signInWithOAuth({ provider: 'google', options });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async teams() {
    const { data, error } = await this.client.from('team_members')
      .select('role,teams(id,name,created_at)')
      .order('created_at', { foreignTable: 'teams', ascending: true });
    if (error) throw error;
    return (data || []).map(item => ({ ...item.teams, role: item.role })).filter(item => item.id);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, session) {
    const state = { event, session, user: session?.user || null };
    this.listeners.forEach(listener => listener(state));
  }

  destroy() {
    this.subscription?.unsubscribe?.();
    this.subscription = null;
    this.listeners.clear();
  }
}

if (typeof window !== 'undefined') window.AuthClient = AuthClient;
if (typeof module !== 'undefined' && module.exports) module.exports = AuthClient;
