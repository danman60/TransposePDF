/** Reconnectable SSE client for audio analysis with polling fallback. */
class AudioJobClient {
  constructor({ fetchImpl = null, EventSourceImpl = null, pollingFallback = null } = {}) {
    this.fetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.EventSource = EventSourceImpl || (typeof EventSource !== 'undefined' ? EventSource : null);
    this.pollingFallback = pollingFallback;
  }

  wait(jobId, { signal = null, onProgress = () => {}, pollingFallback = null } = {}) {
    if (!jobId) return Promise.reject(new Error('jobId is required'));
    const fallback = pollingFallback || this.pollingFallback;
    return new Promise((resolve, reject) => {
      let source = null;
      let settled = false;
      let fallbackStarted = false;
      let fallbackTimer = null;
      let lastEventId = 0;
      let lastSignature = '';

      const close = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = null;
        source?.close();
        source = null;
        signal?.removeEventListener('abort', abort);
      };
      const finish = (method, value) => {
        if (settled) return;
        settled = true;
        close();
        method(value);
      };
      const progress = payload => {
        if (payload.id) lastEventId = Math.max(lastEventId, Number(payload.id) || 0);
        const signature = `${payload.status}|${payload.stage}|${payload.progress}|${payload.error || ''}`;
        if (signature === lastSignature) return;
        lastSignature = signature;
        onProgress(payload);
      };
      const finalResult = async payload => {
        progress(payload);
        try {
          const response = await this.fetch(`/api/audio-jobs/${encodeURIComponent(jobId)}`, { signal });
          const job = await response.json();
          if (!response.ok) throw new Error(job.error || `Status check failed (${response.status})`);
          finish(resolve, job.result);
        } catch (error) {
          finish(reject, error);
        }
      };
      const terminalError = payload => {
        progress(payload);
        const error = new Error(payload.error || (payload.status === 'cancelled' ? 'Audio analysis cancelled' : 'Audio analysis failed'));
        error.name = payload.status === 'cancelled' ? 'AbortError' : 'Error';
        finish(reject, error);
      };
      const parse = event => {
        try {
          const payload = JSON.parse(event.data);
          payload.id = Number(event.lastEventId || payload.id || 0);
          return payload;
        } catch (_) {
          return null;
        }
      };
      const beginFallback = () => {
        if (settled || fallbackStarted) return;
        fallbackStarted = true;
        source?.close();
        source = null;
        const runner = fallback
          ? fallback(jobId, { signal, onProgress: progress, after: lastEventId })
          : this.poll(jobId, { signal, onProgress: progress });
        Promise.resolve(runner).then(result => finish(resolve, result), error => finish(reject, error));
      };
      const abort = () => {
        if (settled) return;
        if (this.fetch) this.fetch(`/api/audio-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
        const error = new Error('Audio analysis cancelled');
        error.name = 'AbortError';
        finish(reject, error);
      };

      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once: true });
      if (!this.EventSource || !this.fetch) {
        beginFallback();
        return;
      }

      source = new this.EventSource(`/api/audio-jobs/${encodeURIComponent(jobId)}/events`);
      source.addEventListener('open', () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = null;
      });
      source.addEventListener('progress', event => {
        const payload = parse(event);
        if (payload) progress(payload);
      });
      source.addEventListener('complete', event => {
        const payload = parse(event);
        if (payload) finalResult(payload);
      });
      source.addEventListener('error', event => {
        if (event?.data) {
          const payload = parse(event);
          if (payload?.status === 'error') {
            terminalError(payload);
            return;
          }
        }
        if (!fallbackTimer) fallbackTimer = setTimeout(beginFallback, 5000);
      });
      source.addEventListener('cancelled', event => {
        const payload = parse(event);
        terminalError(payload || { status: 'cancelled' });
      });
    });
  }

  async poll(jobId, { signal = null, onProgress = () => {}, interval = 1000 } = {}) {
    while (true) {
      const response = await this.fetch(`/api/audio-jobs/${encodeURIComponent(jobId)}`, { signal });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || `Status check failed (${response.status})`);
      onProgress(job);
      if (job.status === 'complete') return job.result;
      if (job.status === 'error') throw new Error(job.error || 'Audio analysis failed');
      if (job.status === 'cancelled') {
        const error = new Error('Audio analysis cancelled');
        error.name = 'AbortError';
        throw error;
      }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, interval);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          const error = new Error('Audio analysis cancelled');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  }
}

if (typeof window !== 'undefined') window.AudioJobClient = AudioJobClient;
if (typeof module !== 'undefined' && module.exports) module.exports = AudioJobClient;
