/** Minimal dedicated-project Supabase adapter for auth, team lookup, and sync RPCs. */
class SupabaseBrowserClient {
  constructor(url, publishableKey, { storage = globalThis.localStorage, location = globalThis.location, fetcher = null } = {}) {
    this.url = String(url || '').replace(/\/+$/, '');
    this.key = String(publishableKey || '').trim();
    this.storage = storage;
    this.location = location;
    this.fetcher = fetcher || ((...args) => globalThis.fetch(...args));
    this.listeners = new Set();
    this.storageKey = `transpose.supabase.session:${this.url}`;
    if (!/^https:\/\//.test(this.url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(this.url)) throw new Error('Use an HTTPS Supabase project URL');
    if (!this.key) throw new Error('Publishable key is required');
    this.auth = {
      getSession: () => this.getSession(),
      onAuthStateChange: listener => this.onAuthStateChange(listener),
      signInWithOtp: input => this.signInWithOtp(input),
      signInWithOAuth: input => this.signInWithOAuth(input),
      signOut: () => this.signOut()
    };
    this.captureCallback();
  }

  headers(authenticated = true) {
    const session = this.readSession();
    return { apikey: this.key, Authorization: `Bearer ${authenticated && session?.access_token ? session.access_token : this.key}`, 'Content-Type': 'application/json' };
  }

  readSession() {
    try { return JSON.parse(this.storage?.getItem(this.storageKey) || 'null'); } catch (_) { return null; }
  }

  captureCallback() {
    const hash = new URLSearchParams(String(this.location?.hash || '').replace(/^#/, ''));
    if (!hash.get('access_token')) return;
    const session = { access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), expires_in: Number(hash.get('expires_in') || 0), token_type: hash.get('token_type') || 'bearer' };
    this.storage?.setItem(this.storageKey, JSON.stringify(session));
    if (this.location) this.location.hash = '';
  }

  async getSession() {
    const session = this.readSession();
    if (!session?.access_token) return { data: { session: null }, error: null };
    const response = await this.fetcher(`${this.url}/auth/v1/user`, { headers: this.headers() });
    if (!response.ok) return { data: { session: null }, error: new Error('Saved sign-in has expired') };
    session.user = await response.json();
    return { data: { session }, error: null };
  }

  onAuthStateChange(listener) {
    this.listeners.add(listener);
    return { data: { subscription: { unsubscribe: () => this.listeners.delete(listener) } } };
  }

  async signInWithOtp({ email, options } = {}) {
    const response = await this.fetcher(`${this.url}/auth/v1/otp`, { method: 'POST', headers: this.headers(false), body: JSON.stringify({ email, create_user: true, gotrue_meta_security: {}, email_redirect_to: options?.emailRedirectTo }) });
    return response.ok ? { data: {}, error: null } : { data: null, error: new Error(await this.errorMessage(response)) };
  }

  async signInWithOAuth({ provider, options } = {}) {
    const url = new URL(`${this.url}/auth/v1/authorize`);
    url.searchParams.set('provider', provider);
    if (options?.redirectTo) url.searchParams.set('redirect_to', options.redirectTo);
    this.location.assign(url.toString());
    return { data: { url: url.toString() }, error: null };
  }

  async signOut() {
    const response = await this.fetcher(`${this.url}/auth/v1/logout`, { method: 'POST', headers: this.headers() });
    this.storage?.removeItem(this.storageKey);
    this.listeners.forEach(listener => listener('SIGNED_OUT', null));
    return response.ok ? { error: null } : { error: new Error(await this.errorMessage(response)) };
  }

  clearLocalSession() { this.storage?.removeItem(this.storageKey); }

  from(table) {
    const query = { select: '*', order: null };
    return {
      select: value => { query.select = value; return this.fromBuilder(table, query); }
    };
  }

  fromBuilder(table, query) {
    const builder = {
      order: (column, options = {}) => { query.order = `${options.foreignTable ? `${options.foreignTable}.` : ''}${column}.${options.ascending === false ? 'desc' : 'asc'}`; return builder; },
      then: (resolve, reject) => this.restSelect(table, query).then(resolve, reject)
    };
    return builder;
  }

  async restSelect(table, query) {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    url.searchParams.set('select', query.select);
    if (query.order) url.searchParams.set('order', query.order);
    const response = await this.fetcher(url, { headers: this.headers() });
    return response.ok ? { data: await response.json(), error: null } : { data: null, error: new Error(await this.errorMessage(response)) };
  }

  async rpc(name, payload) {
    const response = await this.fetcher(`${this.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(payload || {}) });
    return response.ok ? { data: await response.json(), error: null } : { data: null, error: new Error(await this.errorMessage(response)) };
  }

  async errorMessage(response) {
    try { const value = await response.json(); return value.msg || value.message || value.error_description || `Request failed (${response.status})`; }
    catch (_) { return `Request failed (${response.status})`; }
  }
}

if (typeof window !== 'undefined') window.SupabaseBrowserClient = SupabaseBrowserClient;
if (typeof module !== 'undefined' && module.exports) module.exports = SupabaseBrowserClient;
