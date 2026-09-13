/** Stable delegated event boundary for the session selector and rendered chart controls. */
class WorkspaceController {
  constructor(uiController, root) {
    this.ui = uiController;
    this.root = root;
    this.attached = false;
    this.listeners = {};
  }

  attach() {
    if (this.attached || !this.root) return this;
    this.listeners.click = event => this.handleClick(event);
    this.listeners.change = event => this.handleChange(event);
    this.listeners.dragstart = event => this.handleDragStart(event);
    this.listeners.dragover = event => this.handleDragOver(event);
    this.listeners.drop = event => this.handleDrop(event);
    Object.entries(this.listeners).forEach(([name, listener]) => this.root.addEventListener(name, listener));
    this.attached = true;
    return this;
  }

  detach() {
    if (!this.attached || !this.root) return;
    Object.entries(this.listeners).forEach(([name, listener]) => this.root.removeEventListener(name, listener));
    this.listeners = {};
    this.attached = false;
  }

  handleClick(event) {
    const target = event.target.closest?.('[data-action], [data-song-id]');
    if (!target || !this.root.contains(target)) return;
    const action = target.dataset.action || (target.matches('.song-selector-item') ? 'select-song' : '');
    const songId = target.dataset.songId || target.closest('[data-song-id]')?.dataset.songId
      || target.closest('[data-reorder-id]')?.dataset.reorderId;
    if (!action || !songId) return;
    const actions = {
      'select-song': () => this.ui.selectActiveSong(songId),
      'edit-song': () => this.ui.openAuthoring(songId),
      'open-history': () => this.ui.openHistory(songId),
      'transpose-song': () => this.ui.transposeSong(songId, Number(target.dataset.semitones) || 0),
      'reset-song': () => this.ui.resetSong(songId),
      'move-song': () => this.moveSong(target, songId),
      'remove-song': () => this.ui.removeSessionSong(songId)
    };
    if (actions[action]) {
      event.preventDefault();
      actions[action]();
    }
  }

  handleChange(event) {
    const target = event.target.closest?.('[data-action][data-song-id]');
    if (!target || !this.root.contains(target)) return;
    if (target.dataset.action === 'set-spelling') this.ui.setSpellingPolicy(target.dataset.songId, target.value);
    if (target.dataset.action === 'set-chart-view') this.ui.setChartView(target.dataset.songId, target.dataset.field, target.value);
  }

  handleDragStart(event) {
    const row = event.target.closest?.('[data-reorder-id]');
    if (row && this.root.contains(row)) event.dataTransfer?.setData('text/song-id', row.dataset.reorderId);
  }

  handleDragOver(event) {
    if (event.target.closest?.('[data-reorder-id]')) event.preventDefault();
  }

  handleDrop(event) {
    const row = event.target.closest?.('[data-reorder-id]');
    if (!row || !this.root.contains(row)) return;
    event.preventDefault();
    const songId = event.dataTransfer?.getData('text/song-id');
    if (songId) this.ui.reorderSessionSong(songId, [...row.parentElement.children].indexOf(row));
  }

  moveSong(target, songId) {
    const row = target.closest('[data-reorder-id]');
    if (!row) return;
    const delta = target.dataset.direction === 'up' ? -1 : 1;
    this.ui.reorderSessionSong(songId, [...row.parentElement.children].indexOf(row) + delta);
  }
}

if (typeof window !== 'undefined') window.WorkspaceController = WorkspaceController;
if (typeof module !== 'undefined' && module.exports) module.exports = WorkspaceController;
