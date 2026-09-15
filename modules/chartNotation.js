/** Structured musical-notation rows. Source text is authoritative; runs are derived. */
class ChartNotation {
  static chordPattern() {
    return /^(?:N\.C\.|[A-G](?:#{1,2}|b{1,2})?(?:(?:maj|min|m|dim|aug|sus|add|omit|no|alt|[+°ø])?\d*(?:\([^)]*\)|[#b]\d+|add\d+|no\d+|omit\d+|sus\d*)*)?(?:\/[A-G](?:#{1,2}|b{1,2})?)?)$/i;
  }

  static looksLike(value) {
    const text = String(value || '').trim();
    return /^(?:\|\|:|:\|\||\||\[\d+\.|\(\d+\.)/.test(text)
      && /(?:\||:\|\||\|\|:|\/)/.test(text);
  }

  static tokenize(source) {
    return String(source || '').trim().match(/\([^)]*\)|\[[^\]]*\]|\|\|:|:\|\||\|\||\||𝄐|\.{3}|\/|\S+/g) || [];
  }

  static parse(source) {
    const text = String(source || '').replace(/[\r\n]+/g, ' ').trim();
    const chords = [];
    const runs = this.tokenize(text).map(token => {
      if (token === '||:') return { type: 'repeatStart', text: token };
      if (token === ':||') return { type: 'repeatEnd', text: token };
      if (token === '||') return { type: 'doubleBar', text: token };
      if (token === '|') return { type: 'bar', text: token };
      if (token === '/') return { type: 'slash', text: token };
      if (token === '𝄐' || token === '...' || /^\(hold\)$/i.test(token)) return { type: 'hold', text: token };
      if (/^(?:\(|\[)\d+\.(?:\)|\])$/.test(token)) return { type: 'ending', text: token };
      if (/^(?:\(|\[).*(?:\)|\])$/.test(token)) return { type: 'cue', text: token };
      if (this.chordPattern().test(token)) {
        const chord = { symbol: token, characterOffset: chords.length, timestamp: null, confidence: null };
        chords.push(chord);
        return { type: 'chord', text: token, chordIndex: chords.length - 1 };
      }
      return { type: 'text', text: token };
    });
    return { version: 1, source: text, runs, chords };
  }

  static serialize(notation, chordDisplay = null, chords = null) {
    const source = typeof notation === 'string' ? this.parse(notation) : notation || this.parse('');
    const values = chords || source.chords || [];
    return (source.runs || []).map(run => {
      if (run.type !== 'chord') return run.text;
      const chord = values[run.chordIndex] || source.chords?.[run.chordIndex] || { symbol: run.text };
      return chordDisplay ? chordDisplay(chord.symbol, chord) : chord.symbol;
    }).join(' ');
  }
}

if (typeof window !== 'undefined') window.ChartNotation = ChartNotation;
if (typeof module !== 'undefined' && module.exports) module.exports = ChartNotation;
