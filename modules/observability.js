/** Structured, privacy-bounded diagnostics with optional SessionTelemetry forwarding. */
class Observability {
  constructor(options = {}) {
    this.logs = [];
    this.metrics = {};
    this.telemetry = options.telemetry || null;
    this.maxLogs = Math.max(20, Number(options.maxLogs) || 500);
  }

  setTelemetry(telemetry) {
    this.telemetry = telemetry || null;
    return this;
  }

  status(message, type = 'info', context = {}) {
    const level = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
    const entry = { timestamp: Date.now(), level, type: level, message: this.cleanText(message), context: this.cleanContext(context) };
    this.record(entry);
    if (typeof console !== 'undefined') console.log(`[${level.toUpperCase()}] ${entry.message}`);
    return entry;
  }

  startTimer(operation, context = {}) {
    this.metrics[operation] = { code: this.code(operation, 'TIMER'), start: this.now(), context: this.cleanContext(context) };
    return this.metrics[operation].code;
  }

  endTimer(operation, context = {}) {
    const timer = this.metrics[operation];
    if (!timer || !Number.isFinite(timer.start)) return null;
    timer.duration = Math.max(0, this.now() - timer.start);
    timer.completedAt = Date.now();
    timer.context = { ...timer.context, ...this.cleanContext(context) };
    this.status(`${operation} completed in ${timer.duration.toFixed(0)}ms`, 'info', { code: timer.code, durationMs: Math.round(timer.duration) });
    return timer.duration;
  }

  error(message, context = {}) {
    const cleanContext = this.cleanContext(context) || {};
    const errorCode = cleanContext.code ? this.code(cleanContext.code, 'ERR') : 'ERR_RUNTIME';
    delete cleanContext.code;
    const entry = { timestamp: Date.now(), level: 'error', type: 'error', code: errorCode, message: this.cleanMessage(message), context: cleanContext };
    this.record(entry);
    if (typeof console !== 'undefined') console.error(`TransposeApp Error [${errorCode}]:`, entry.message, cleanContext);
    this.emit('ui.error', { code: errorCode, context: cleanContext }, { screen: 'error' });
    return entry;
  }

  emit(eventType, data = {}, context = {}) {
    try {
      this.telemetry?.emit?.(eventType, this.cleanContext(data), this.cleanContext(context));
      return true;
    } catch (_) { return false; }
  }

  exportLogs() {
    const metrics = Object.fromEntries(Object.entries(this.metrics).map(([name, metric]) => [name, {
      code: metric.code, duration: Number.isFinite(metric.duration) ? metric.duration : null,
      completedAt: metric.completedAt || null, context: this.cleanContext(metric.context)
    }]));
    return { logs: this.logs.map(entry => ({ ...entry, context: this.cleanContext(entry.context) })), metrics, performance: this.getPerformanceSnapshot() };
  }

  getPerformanceSnapshot() {
    const memory = typeof performance !== 'undefined' && performance.memory ? performance.memory : null;
    const timing = typeof performance !== 'undefined' && performance.timing ? performance.timing : null;
    return {
      memory: memory ? { usedJSHeapSize: Number(memory.usedJSHeapSize) || 0, totalJSHeapSize: Number(memory.totalJSHeapSize) || 0, jsHeapSizeLimit: Number(memory.jsHeapSizeLimit) || 0 } : null,
      timing: timing ? { loadEventEnd: Number(timing.loadEventEnd) || 0, domContentLoadedEventEnd: Number(timing.domContentLoadedEventEnd) || 0 } : null
    };
  }

  cleanContext(value, depth = 0) {
    if (depth > 5 || value === undefined) return null;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return this.cleanMessage(value);
    if (Array.isArray(value)) return value.slice(0, 50).map(item => this.cleanContext(item, depth + 1));
    if (typeof value !== 'object') return this.cleanMessage(value);
    const blocked = /^(stack|path|file|filename|url|audio|pdf|blob|bytes|rawAnalysis|transcript|transcriptText|authoritativeLyrics|textItems)$/i;
    return Object.fromEntries(Object.entries(value).slice(0, 50)
      .filter(([key]) => !blocked.test(key))
      .map(([key, item]) => [String(key).slice(0, 64), this.cleanContext(item, depth + 1)]));
  }

  cleanMessage(value) {
    return this.cleanText(value).replace(/(?:file:\/\/|https?:\/\/|[A-Za-z]:\\|\/(?:home|Users|mnt)\/)[^\s]+/g, '[redacted]');
  }

  cleanText(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 500);
  }

  code(value, prefix) {
    const body = String(value || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'UNKNOWN';
    return body.startsWith(`${prefix}_`) ? body : `${prefix}_${body}`;
  }

  now() { return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
  record(entry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.splice(0, this.logs.length - this.maxLogs);
  }
}

if (typeof window !== 'undefined') window.Observability = Observability;
if (typeof module !== 'undefined' && module.exports) module.exports = Observability;
