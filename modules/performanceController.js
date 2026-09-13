/**
 * State and device-lifecycle controller for distraction-free chart performance.
 * Rendering and song selection stay injected so this module has no markup contract.
 */
class PerformanceController {
  constructor(options = {}) {
    this.getSongs = options.getSongs || (() => []);
    this.getActiveSongId = options.getActiveSongId || (() => null);
    this.selectSongHook = options.selectSong || (() => undefined);
    this.renderHook = options.render || (() => undefined);
    this.onStateChange = options.onStateChange || (() => undefined);
    this.document = options.document || (typeof document !== 'undefined' ? document : null);
    this.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    this.window = options.window || (typeof window !== 'undefined' ? window : null);
    this.now = options.now || (() => Date.now());
    this.scrollPositions = new Map();
    this.wakeLock = null;
    this.frame = null;
    this.lastFrameAt = 0;
    this.state = {
      active: false,
      fontScale: 1,
      columns: 1,
      autoscroll: false,
      autoscrollSpeed: 28,
      fullscreen: false,
      wakeLockActive: false,
      reducedMotion: options.reducedMotion ?? this.detectReducedMotion()
    };
    this.handleVisibility = this.handleVisibility.bind(this);
    this.handleFullscreen = this.handleFullscreen.bind(this);
    this.document?.addEventListener?.('visibilitychange', this.handleVisibility);
    this.document?.addEventListener?.('fullscreenchange', this.handleFullscreen);
  }

  detectReducedMotion() {
    return Boolean(this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  snapshot() {
    return { ...this.state, scrollPositions: Object.fromEntries(this.scrollPositions) };
  }

  publish(reason) {
    const snapshot = this.snapshot();
    this.renderHook(snapshot, reason);
    this.onStateChange(snapshot, reason);
    return snapshot;
  }

  async enter(options = {}) {
    this.state.active = true;
    if (options.fullscreen) await this.requestFullscreen(options.fullscreenElement);
    if (options.wakeLock !== false) await this.requestWakeLock();
    if (this.state.autoscroll) this.startAutoscroll();
    return this.publish('enter');
  }

  async exit() {
    this.saveScroll();
    this.stopAutoscroll();
    await this.releaseWakeLock();
    if (this.document?.fullscreenElement && this.document.exitFullscreen) await this.document.exitFullscreen();
    this.state.active = false;
    this.state.fullscreen = false;
    return this.publish('exit');
  }

  orderedSongs() {
    return [...(this.getSongs() || [])];
  }

  activeIndex() {
    const id = String(this.getActiveSongId() ?? '');
    return this.orderedSongs().findIndex(song => String(song.id) === id);
  }

  async selectAt(index) {
    const songs = this.orderedSongs();
    if (!songs.length) return null;
    const target = Math.max(0, Math.min(songs.length - 1, Number(index)));
    this.saveScroll();
    await this.selectSongHook(songs[target].id);
    this.restoreScroll(songs[target].id);
    this.publish('song.select');
    return songs[target];
  }

  next() {
    const index = this.activeIndex();
    return this.selectAt(index < 0 ? 0 : index + 1);
  }

  previous() {
    const index = this.activeIndex();
    return this.selectAt(index < 0 ? 0 : index - 1);
  }

  scrollTarget() {
    return this.window;
  }

  saveScroll(songId = this.getActiveSongId()) {
    if (songId === null || songId === undefined) return;
    const target = this.scrollTarget();
    const value = Number(target?.scrollY ?? target?.pageYOffset ?? 0) || 0;
    this.scrollPositions.set(String(songId), value);
  }

  restoreScroll(songId = this.getActiveSongId()) {
    const value = this.scrollPositions.get(String(songId)) || 0;
    this.scrollTarget()?.scrollTo?.({ top: value, behavior: this.state.reducedMotion ? 'auto' : 'smooth' });
    return value;
  }

  setFontScale(value) {
    this.state.fontScale = Math.max(0.7, Math.min(2, Number(value) || 1));
    return this.publish('settings.font');
  }

  setColumns(value) {
    this.state.columns = Math.max(1, Math.min(3, Math.round(Number(value) || 1)));
    return this.publish('settings.columns');
  }

  setAutoscroll(enabled, speed = this.state.autoscrollSpeed) {
    this.state.autoscroll = Boolean(enabled);
    this.state.autoscrollSpeed = Math.max(4, Math.min(160, Number(speed) || 28));
    if (this.state.active && this.state.autoscroll) this.startAutoscroll();
    else this.stopAutoscroll();
    return this.publish('settings.autoscroll');
  }

  startAutoscroll() {
    if (this.frame || !this.state.active || !this.state.autoscroll || this.state.reducedMotion) return;
    this.lastFrameAt = this.now();
    const tick = timestamp => {
      if (!this.state.active || !this.state.autoscroll) return this.stopAutoscroll();
      const elapsed = Math.max(0, Math.min(100, timestamp - this.lastFrameAt));
      this.lastFrameAt = timestamp;
      this.scrollTarget()?.scrollBy?.(0, this.state.autoscrollSpeed * elapsed / 1000);
      this.frame = this.window?.requestAnimationFrame?.(tick) || null;
    };
    this.frame = this.window?.requestAnimationFrame?.(tick) || null;
  }

  stopAutoscroll() {
    if (this.frame) this.window?.cancelAnimationFrame?.(this.frame);
    this.frame = null;
  }

  async requestWakeLock() {
    if (!this.navigator?.wakeLock?.request || this.document?.visibilityState === 'hidden') return false;
    try {
      this.wakeLock = await this.navigator.wakeLock.request('screen');
      this.state.wakeLockActive = true;
      this.wakeLock?.addEventListener?.('release', () => {
        this.state.wakeLockActive = false;
        this.publish('wake.release');
      }, { once: true });
      return true;
    } catch (_) {
      this.state.wakeLockActive = false;
      return false;
    }
  }

  async releaseWakeLock() {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (lock?.release) await lock.release();
    this.state.wakeLockActive = false;
  }

  async requestFullscreen(element = this.document?.documentElement) {
    if (!element?.requestFullscreen) return false;
    try {
      await element.requestFullscreen();
      this.state.fullscreen = true;
      return true;
    } catch (_) {
      this.state.fullscreen = false;
      return false;
    }
  }

  handleFullscreen() {
    this.state.fullscreen = Boolean(this.document?.fullscreenElement);
    this.publish('fullscreen.change');
  }

  async handleVisibility() {
    if (this.document?.visibilityState === 'visible' && this.state.active && !this.wakeLock) {
      await this.requestWakeLock();
      this.publish('wake.reacquire');
    }
  }

  destroy() {
    this.stopAutoscroll();
    this.releaseWakeLock().catch(() => undefined);
    this.document?.removeEventListener?.('visibilitychange', this.handleVisibility);
    this.document?.removeEventListener?.('fullscreenchange', this.handleFullscreen);
  }
}

if (typeof window !== 'undefined') window.PerformanceController = PerformanceController;
if (typeof module !== 'undefined' && module.exports) module.exports = PerformanceController;
