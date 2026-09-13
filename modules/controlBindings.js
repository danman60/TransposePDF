/** Persisted keyboard and Web MIDI action bindings with explicit conflict replacement. */
class ControlBindings {
  static STORAGE_KEY = 'transposepdf.control-bindings.v1';

  constructor(options = {}) {
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    this.document = options.document || (typeof document !== 'undefined' ? document : null);
    this.actions = { ...(options.actions || {}) };
    this.debounceMs = Number(options.debounceMs) || 180;
    this.now = options.now || (() => Date.now());
    this.keyboard = {};
    this.midi = {};
    this.captureState = null;
    this.pendingConflict = null;
    this.lastDispatch = new Map();
    this.midiAccess = null;
    this.boundKeydown = event => this.handleKeydown(event);
    this.boundMidiState = () => this.bindMidiInputs();
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(ControlBindings.STORAGE_KEY) || '{}');
      this.keyboard = parsed.keyboard && typeof parsed.keyboard === 'object' ? parsed.keyboard : {};
      this.midi = parsed.midi && typeof parsed.midi === 'object' ? parsed.midi : {};
    } catch (_) {
      this.keyboard = {};
      this.midi = {};
    }
    return this.snapshot();
  }

  save() {
    const value = JSON.stringify({ version: 1, keyboard: this.keyboard, midi: this.midi });
    try { this.storage?.setItem(ControlBindings.STORAGE_KEY, value); } catch (_) {}
    return this.snapshot();
  }

  snapshot() {
    return {
      keyboard: JSON.parse(JSON.stringify(this.keyboard)),
      midi: JSON.parse(JSON.stringify(this.midi)),
      capture: this.captureState ? { ...this.captureState } : null,
      conflict: this.pendingConflict ? JSON.parse(JSON.stringify(this.pendingConflict)) : null
    };
  }

  registerAction(name, handler) {
    if (typeof handler !== 'function') throw new TypeError('Control action must be a function');
    this.actions[name] = handler;
  }

  start() {
    this.document?.addEventListener?.('keydown', this.boundKeydown);
    return this.connectMIDI();
  }

  stop() {
    this.document?.removeEventListener?.('keydown', this.boundKeydown);
    if (this.midiAccess) this.midiAccess.onstatechange = null;
    for (const input of this.midiAccess?.inputs?.values?.() || []) input.onmidimessage = null;
  }

  capture(action, type = 'keyboard') {
    if (!this.actions[action]) throw new Error(`Unknown control action: ${action}`);
    if (!['keyboard', 'midi'].includes(type)) throw new Error('Control type must be keyboard or midi');
    this.captureState = { action, type };
    this.pendingConflict = null;
    return this.snapshot();
  }

  cancelCapture() {
    this.captureState = null;
    this.pendingConflict = null;
  }

  keyboardDescriptor(event) {
    return {
      code: event.code || event.key,
      key: event.key || '',
      altKey: Boolean(event.altKey), ctrlKey: Boolean(event.ctrlKey),
      metaKey: Boolean(event.metaKey), shiftKey: Boolean(event.shiftKey)
    };
  }

  descriptorKey(type, descriptor) {
    if (type === 'keyboard') {
      return [descriptor.ctrlKey ? 'C' : '', descriptor.altKey ? 'A' : '', descriptor.shiftKey ? 'S' : '', descriptor.metaKey ? 'M' : '', descriptor.code].join(':');
    }
    return `${descriptor.kind}:${descriptor.channel}:${descriptor.number}`;
  }

  findConflict(type, descriptor, exceptAction) {
    const target = this.descriptorKey(type, descriptor);
    return Object.entries(this[type]).find(([action, binding]) => action !== exceptAction && this.descriptorKey(type, binding) === target)?.[0] || null;
  }

  assign(action, type, descriptor, replace = false) {
    const conflictAction = this.findConflict(type, descriptor, action);
    if (conflictAction && !replace) {
      this.pendingConflict = { action, type, descriptor: { ...descriptor }, conflictAction };
      return { assigned: false, conflict: this.pendingConflict };
    }
    if (conflictAction) delete this[type][conflictAction];
    this[type][action] = { ...descriptor };
    this.captureState = null;
    this.pendingConflict = null;
    this.save();
    return { assigned: true, replaced: conflictAction };
  }

  replaceConflict() {
    if (!this.pendingConflict) return { assigned: false, conflict: null };
    const { action, type, descriptor } = this.pendingConflict;
    return this.assign(action, type, descriptor, true);
  }

  clear(action, type) {
    if (this[type]) delete this[type][action];
    this.save();
  }

  isEditable(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toLowerCase();
    return Boolean(target.isContentEditable || ['input', 'textarea', 'select'].includes(tag) || target.closest?.('[contenteditable="true"]'));
  }

  handleKeydown(event) {
    if (this.captureState?.type === 'keyboard') {
      event.preventDefault?.();
      return this.assign(this.captureState.action, 'keyboard', this.keyboardDescriptor(event));
    }
    if (this.isEditable(event.target)) return false;
    const descriptor = this.keyboardDescriptor(event);
    const action = Object.entries(this.keyboard).find(([, binding]) => this.descriptorKey('keyboard', binding) === this.descriptorKey('keyboard', descriptor))?.[0];
    if (!action) return false;
    event.preventDefault?.();
    return this.dispatch(action, `keyboard:${this.descriptorKey('keyboard', descriptor)}`, event);
  }

  dispatch(action, signature, event) {
    const handler = this.actions[action];
    if (!handler) return false;
    const now = this.now();
    if (now - (this.lastDispatch.get(signature) ?? -Infinity) < this.debounceMs) return false;
    this.lastDispatch.set(signature, now);
    handler(event);
    return true;
  }

  async connectMIDI() {
    if (!this.navigator?.requestMIDIAccess) return false;
    try {
      this.midiAccess = await this.navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = this.boundMidiState;
      this.bindMidiInputs();
      return true;
    } catch (_) {
      return false;
    }
  }

  bindMidiInputs() {
    for (const input of this.midiAccess?.inputs?.values?.() || []) {
      input.onmidimessage = event => this.handleMIDIMessage(event);
    }
  }

  midiDescriptor(event) {
    const [status = 0, number = 0, value = 0] = event.data || [];
    const command = status & 0xf0;
    const channel = status & 0x0f;
    if (command === 0xc0) return { kind: 'program', channel, number, value };
    if (command === 0xb0) return { kind: 'cc', channel, number, value };
    return null;
  }

  handleMIDIMessage(event) {
    const descriptor = this.midiDescriptor(event);
    if (!descriptor) return false;
    if (descriptor.kind === 'cc' && descriptor.value === 0) return false;
    if (this.captureState?.type === 'midi') {
      return this.assign(this.captureState.action, 'midi', descriptor);
    }
    const action = Object.entries(this.midi).find(([, binding]) => this.descriptorKey('midi', binding) === this.descriptorKey('midi', descriptor))?.[0];
    if (!action) return false;
    return this.dispatch(action, `midi:${this.descriptorKey('midi', descriptor)}`, event);
  }
}

if (typeof window !== 'undefined') window.ControlBindings = ControlBindings;
if (typeof module !== 'undefined' && module.exports) module.exports = ControlBindings;
