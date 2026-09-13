/** Customer-facing team-sync settings. Local-only remains the safe default. */
class TeamSyncController {
  static CONFIG_KEY = 'transpose.teamSync.config';

  constructor({ library, elements, storage = globalThis.localStorage, clientFactory = (url, key) => new SupabaseBrowserClient(url, key), location = globalThis.location } = {}) {
    this.library = library;
    this.elements = elements;
    this.storage = storage;
    this.clientFactory = clientFactory;
    this.location = location;
    this.auth = null;
    this.sync = null;
    this.session = null;
    this.teams = [];
    this.config = this.readConfig();
  }

  attach() {
    const e = this.elements;
    e.open?.addEventListener('click', () => this.open());
    e.close?.addEventListener('click', () => { e.drawer.hidden = true; });
    e.save?.addEventListener('click', () => this.saveConfiguration());
    e.disconnect?.addEventListener('click', () => this.disconnect());
    e.emailSignIn?.addEventListener('click', () => this.emailSignIn());
    e.googleSignIn?.addEventListener('click', () => this.googleSignIn());
    e.signOut?.addEventListener('click', () => this.signOut());
    e.team?.addEventListener('change', () => this.selectTeam(e.team.value));
    e.syncNow?.addEventListener('click', () => this.syncNow());
    e.share?.addEventListener('click', () => this.share());
    this.fillConfiguration();
    this.render();
    if (this.config.url && this.config.publishableKey) this.connect().catch(error => this.setStatus(error.message, 'error'));
    return this;
  }

  readConfig() {
    try { return JSON.parse(this.storage?.getItem(TeamSyncController.CONFIG_KEY) || '{}'); } catch (_) { return {}; }
  }

  fillConfiguration() {
    if (this.elements.url) this.elements.url.value = this.config.url || '';
    if (this.elements.key) this.elements.key.value = this.config.publishableKey || '';
  }

  async saveConfiguration() {
    const url = this.elements.url.value.trim().replace(/\/+$/, '');
    const publishableKey = this.elements.key.value.trim();
    try {
      this.clientFactory(url, publishableKey);
      this.config = { url, publishableKey, teamId: '' };
      this.storage?.setItem(TeamSyncController.CONFIG_KEY, JSON.stringify(this.config));
      await this.connect();
    } catch (error) { this.setStatus(error.message, 'error'); }
  }

  async connect() {
    this.auth?.destroy?.();
    const client = this.clientFactory(this.config.url, this.config.publishableKey);
    this.auth = new AuthClient(client);
    this.sync = new SyncStore({ client, library: this.library, teamId: this.config.teamId });
    this.auth.subscribe(state => { this.session = state.session; this.refreshTeams().catch(error => this.setStatus(error.message, 'error')); this.render(); });
    this.session = await this.auth.initialize();
    if (this.session) await this.refreshTeams();
    this.setStatus(this.session ? 'Connected' : 'Project configured. Sign in to continue.', 'ready');
    this.render();
  }

  disconnect() {
    this.auth?.client?.clearLocalSession?.(); this.auth?.destroy?.(); this.auth = null; this.sync = null; this.session = null; this.teams = []; this.config = {};
    this.storage?.removeItem(TeamSyncController.CONFIG_KEY);
    this.fillConfiguration(); this.setStatus('Local only. Nothing leaves this device.', 'local'); this.render();
  }

  async emailSignIn() {
    const email = this.elements.email.value.trim();
    if (!email) return this.setStatus('Enter an email address.', 'error');
    try { await this.auth.signInWithEmail(email, { redirectTo: this.location?.href?.split('#')[0] }); this.setStatus(`Sign-in link sent to ${email}`, 'ready'); }
    catch (error) { this.setStatus(error.message, 'error'); }
  }

  async googleSignIn() { try { await this.auth.signInWithGoogle({ redirectTo: this.location?.href?.split('#')[0] }); } catch (error) { this.setStatus(error.message, 'error'); } }
  async signOut() { try { await this.auth.signOut(); this.session = null; this.teams = []; this.config.teamId = ''; this.persistConfig(); this.render(); } catch (error) { this.setStatus(error.message, 'error'); } }

  async refreshTeams() {
    this.teams = this.session ? await this.auth.teams() : [];
    if (!this.teams.some(team => team.id === this.config.teamId)) this.config.teamId = this.teams[0]?.id || '';
    this.sync?.setTeam(this.config.teamId); this.persistConfig(); await this.refreshState(); this.render();
  }

  async selectTeam(teamId) { this.config.teamId = String(teamId || ''); this.sync?.setTeam(this.config.teamId); this.persistConfig(); await this.refreshState(); this.render(); }

  async refreshState() {
    const [outbox, conflicts] = await Promise.all([this.library.getAllRecords('syncOutbox'), this.sync?.conflicts?.() || []]);
    this.outbox = outbox.filter(item => !this.config.teamId || item.teamId === this.config.teamId);
    this.conflictItems = conflicts;
  }

  async syncNow() {
    if (!this.sync || !this.config.teamId) return;
    this.setStatus('Syncing…', 'working');
    try { const pushed = await this.sync.drain(); const pulled = await this.sync.pull(); await this.refreshState(); this.setStatus(`Synced · ${pushed.pushed} sent · ${pulled.applied} received`, 'ready'); this.render(); }
    catch (error) { await this.refreshState(); this.setStatus(error.message, 'error'); this.render(); }
  }

  async share() {
    if (!this.canShare()) return;
    const url = `${this.location.origin}${this.location.pathname}#team=${encodeURIComponent(this.config.teamId)}`;
    try { await globalThis.navigator?.clipboard?.writeText(url); this.setStatus('Team link copied', 'ready'); }
    catch (_) { this.elements.shareOutput.value = url; this.elements.shareOutput.hidden = false; this.elements.shareOutput.select(); }
  }

  canShare() { return Boolean(this.auth && this.session?.user && this.config.teamId && this.teams.some(team => team.id === this.config.teamId)); }
  persistConfig() { this.storage?.setItem(TeamSyncController.CONFIG_KEY, JSON.stringify(this.config)); }
  open() { this.elements.drawer.hidden = false; this.refreshState().then(() => this.render()); }
  setStatus(message, state) { this.status = { message, state }; if (this.elements.status) { this.elements.status.textContent = message; this.elements.status.dataset.state = state; } }

  render() {
    const configured = Boolean(this.config.url && this.config.publishableKey);
    const signedIn = Boolean(this.session?.user);
    this.elements.localPanel.hidden = configured;
    this.elements.authPanel.hidden = !configured || signedIn;
    this.elements.teamPanel.hidden = !signedIn;
    this.elements.disconnect.hidden = !configured;
    this.elements.open.dataset.state = signedIn && this.config.teamId ? 'synced' : configured ? 'configured' : 'local';
    this.elements.open.textContent = signedIn && this.config.teamId ? 'Team sync' : 'Local only';
    if (signedIn) {
      this.elements.user.textContent = this.session.user.email || 'Signed in';
      this.elements.team.innerHTML = this.teams.length ? this.teams.map(team => `<option value="${this.escape(team.id)}"${team.id === this.config.teamId ? ' selected' : ''}>${this.escape(team.name)} · ${this.escape(team.role)}</option>`).join('') : '<option value="">No teams available</option>';
      this.elements.outbox.textContent = String(this.outbox?.length || 0);
      if (this.elements.conflictCount) this.elements.conflictCount.textContent = String(this.conflictItems?.length || 0);
      this.elements.conflicts.innerHTML = this.conflictItems?.length ? this.conflictItems.map(item => `<li><strong>${this.escape(item.entityType)}</strong> ${this.escape(item.entityId)}<span>Needs review</span></li>`).join('') : '<li class="empty-state">No conflicts</li>';
    }
    this.elements.syncNow.disabled = !this.config.teamId;
    this.elements.share.hidden = !this.canShare();
    this.elements.shareOutput.hidden = true;
  }

  escape(value) { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; }
}

if (typeof window !== 'undefined') window.TeamSyncController = TeamSyncController;
if (typeof module !== 'undefined' && module.exports) module.exports = TeamSyncController;
