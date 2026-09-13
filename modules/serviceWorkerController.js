/** User-controlled service-worker updates and connectivity state. */
class ServiceWorkerController {
  constructor(options = {}) {
    this.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    this.window = options.window || (typeof window !== 'undefined' ? window : null);
    this.banner = options.banner || null;
    this.message = options.message || null;
    this.reloadButton = options.reloadButton || null;
    this.laterButton = options.laterButton || null;
    this.offlineBadge = options.offlineBadge || null;
    this.isDraftDirty = options.isDraftDirty || (() => false);
    this.registration = null;
    this.waitingWorker = null;
    this.reloadRequested = false;
    this.reloaded = false;
    this.onControllerChange = this.onControllerChange.bind(this);
    this.onOnlineChange = this.renderConnectivity.bind(this);
  }

  async start(script = '/service-worker.js') {
    this.renderConnectivity();
    this.window?.addEventListener?.('online', this.onOnlineChange);
    this.window?.addEventListener?.('offline', this.onOnlineChange);
    this.reloadButton?.addEventListener?.('click', () => this.activateUpdate());
    this.laterButton?.addEventListener?.('click', () => this.dismiss());
    if (!this.navigator?.serviceWorker) return null;
    this.navigator.serviceWorker.addEventListener('controllerchange', this.onControllerChange);
    this.registration = await this.navigator.serviceWorker.register(script);
    if (this.registration.waiting) this.showUpdate(this.registration.waiting);
    this.registration.addEventListener('updatefound', () => {
      const worker = this.registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && this.navigator.serviceWorker.controller) this.showUpdate(worker);
      });
    });
    return this.registration;
  }

  showUpdate(worker) {
    this.waitingWorker = worker;
    this.banner.hidden = false;
    this.renderDirtyState();
  }

  renderDirtyState() {
    const dirty = Boolean(this.isDraftDirty());
    this.reloadButton.disabled = dirty;
    this.message.textContent = dirty
      ? 'Save or discard editor changes before reloading.'
      : 'A newer version is ready. Reload when convenient.';
    return dirty;
  }

  activateUpdate() {
    if (!this.waitingWorker || this.renderDirtyState()) return false;
    this.reloadRequested = true;
    this.reloadButton.disabled = true;
    this.message.textContent = 'Updating…';
    this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }

  dismiss() {
    this.banner.hidden = true;
  }

  onControllerChange() {
    if (!this.reloadRequested || this.reloaded) return;
    this.reloaded = true;
    this.window.location.reload();
  }

  renderConnectivity() {
    const offline = this.navigator?.onLine === false;
    this.offlineBadge.hidden = !offline;
    this.offlineBadge.textContent = offline ? 'Offline' : '';
    return offline;
  }

  destroy() {
    this.window?.removeEventListener?.('online', this.onOnlineChange);
    this.window?.removeEventListener?.('offline', this.onOnlineChange);
    this.navigator?.serviceWorker?.removeEventListener?.('controllerchange', this.onControllerChange);
  }
}

if (typeof window !== 'undefined') window.ServiceWorkerController = ServiceWorkerController;
if (typeof module !== 'undefined' && module.exports) module.exports = ServiceWorkerController;
