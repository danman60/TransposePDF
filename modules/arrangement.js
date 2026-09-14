/** Pure section-order inference. Manual arrangement text always wins verbatim. */
class Arrangement {
  static TYPES = {
    intro: 'I', verse: 'V', 'pre-chorus': 'PC', prechorus: 'PC', chorus: 'C',
    refrain: 'R', bridge: 'B', interlude: 'Int', instrumental: 'Inst', solo: 'S',
    tag: 'T', vamp: 'Vamp', coda: 'Co', ending: 'E', outro: 'O', section: 'Sec'
  };

  static infer(sections = []) {
    const counts = new Map();
    return sections.map(section => {
      const type = this.normalizeType(section?.label || section?.type);
      counts.set(type, (counts.get(type) || 0) + 1);
      return this.shorthand(section, counts.get(type));
    }).filter(Boolean).join(' ');
  }

  static shorthand(section = {}, occurrence = 1) {
    const label = String(section.label || '').trim();
    const type = this.normalizeType(label || section.type);
    const base = this.TYPES[type] || this.customLabel(label || section.type);
    const explicitNumber = label.match(/(?:^|\s)(\d+)(?:\s|$)/)?.[1];
    if (explicitNumber) return `${base}${explicitNumber}`;
    return type === 'verse' ? `${base}${occurrence}` : base;
  }

  static normalizeType(value) {
    return String(value || 'section').trim().toLowerCase()
      .replace(/[_\s]+/g, '-').replace(/-?\d+$/, '').replace(/^final-/, '') || 'section';
  }

  static customLabel(value) {
    const words = String(value || 'Section').trim().split(/[\s_-]+/).filter(Boolean);
    return words.length > 1 ? words.map(word => word[0]).join('').toUpperCase() : words[0]?.slice(0, 3) || 'Sec';
  }

  static normalize(value, sections = []) {
    const inferredValue = this.infer(sections);
    const mode = value?.mode === 'manual' ? 'manual' : 'auto';
    return {
      mode,
      value: mode === 'manual' ? String(value?.value ?? '') : inferredValue,
      inferredValue,
      updatedAt: value?.updatedAt ?? null
    };
  }

  static resolve(value, sections = []) {
    return this.normalize(value, sections).value;
  }
}

if (typeof window !== 'undefined') window.Arrangement = Arrangement;
if (typeof module !== 'undefined' && module.exports) module.exports = Arrangement;
