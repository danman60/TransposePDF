const assert = require('assert');
const SupabaseBrowserClient = require('../modules/supabaseBrowserClient');
global.AuthClient = require('../modules/authClient');
global.SyncStore = require('../modules/syncStore');
global.SupabaseBrowserClient = SupabaseBrowserClient;
global.document = { createElement: () => ({ set textContent(value) { this.innerHTML = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;'); } }) };
const TeamSyncController = require('../modules/teamSyncController');

const storage = () => ({ values: new Map(), getItem(key) { return this.values.get(key) || null; }, setItem(key, value) { this.values.set(key, value); }, removeItem(key) { this.values.delete(key); } });
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

(async () => {
  assert.throws(() => new SupabaseBrowserClient('http://example.com', 'key'), /HTTPS/);
  assert.throws(() => new SupabaseBrowserClient('https://dedicated.supabase.co', ''), /key/);
  const calls = [];
  const local = storage();
  const client = new SupabaseBrowserClient('https://dedicated.supabase.co', 'publishable', {
    storage: local, location: { hash: '', assign: value => calls.push(['redirect', value]) },
    fetcher: async (url, options = {}) => { calls.push([String(url), options]); return response(url.toString().includes('/auth/v1/user') ? { id: 'u1', email: 'member@example.com' } : []); }
  });
  await client.auth.signInWithOtp({ email: 'member@example.com', options: { emailRedirectTo: 'http://localhost:8000/' } });
  assert.equal(JSON.parse(calls[0][1].body).email_redirect_to, 'http://localhost:8000/');
  assert.equal(calls[0][0], 'https://dedicated.supabase.co/auth/v1/otp');
  await client.rpc('sync_upsert', { p_team_id: 't1' });
  assert.equal(calls[1][0], 'https://dedicated.supabase.co/rest/v1/rpc/sync_upsert');

  const elements = {};
  ['open','drawer','close','status','localPanel','authPanel','teamPanel','url','key','save','disconnect','email','emailSignIn','googleSignIn','signOut','user','team','syncNow','outbox','conflictCount','conflicts','share','shareOutput'].forEach(key => {
    elements[key] = { hidden: false, disabled: false, value: '', textContent: '', innerHTML: '', dataset: {}, addEventListener() {}, select() {} };
  });
  const controller = new TeamSyncController({ library: {}, elements, storage: local, clientFactory: () => client, location: { origin: 'http://localhost:8000', pathname: '/' } });
  controller.config = { url: 'https://dedicated.supabase.co', publishableKey: 'publishable', teamId: 't1' };
  controller.auth = {}; controller.session = { user: { email: 'member@example.com' } }; controller.teams = [{ id: 't1', name: 'Band', role: 'member' }]; controller.outbox = []; controller.conflictItems = [];
  assert.equal(controller.canShare(), true);
  controller.config.teamId = '';
  assert.equal(controller.canShare(), false);
  controller.disconnect();
  assert.equal(elements.open.textContent, 'Local only');
  assert.equal(local.getItem(TeamSyncController.CONFIG_KEY), null);
  client.clearLocalSession();
  assert.equal(local.getItem('transpose.supabase.session:https://dedicated.supabase.co'), null);
  console.log('team sync contract: 10 assertions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
