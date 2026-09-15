/** Deterministic Helvetica-compatible text metrics shared by editor planning and PDF projection. */
class ChartTextMetrics {
  static HELVETICA = {
    ' ':278,'!':278,'"':355,'#':556,'$':556,'%':889,'&':667,"'":191,'(':333,')':333,'*':389,'+':584,',':278,'-':333,'.':278,'/':278,
    '0':556,'1':556,'2':556,'3':556,'4':556,'5':556,'6':556,'7':556,'8':556,'9':556,':':278,';':278,'<':584,'=':584,'>':584,'?':556,'@':1015,
    A:667,B:667,C:722,D:722,E:667,F:611,G:778,H:722,I:278,J:500,K:667,L:556,M:833,N:722,O:778,P:667,Q:778,R:722,S:667,T:611,U:722,V:667,W:944,X:667,Y:667,Z:611,
    '[':278,'\\':278,']':278,'^':469,'_':556,'`':333,
    a:556,b:556,c:500,d:556,e:556,f:278,g:556,h:556,i:222,j:222,k:500,l:222,m:833,n:556,o:556,p:556,q:556,r:333,s:500,t:278,u:556,v:500,w:722,x:500,y:500,z:500,
    '{':334,'|':260,'}':334,'~':584
  };

  static normalize(mode) { return mode === 'sans' ? 'sans' : 'mono'; }

  static unit(character, mode = 'mono') {
    if (this.normalize(mode) === 'mono') return .6;
    return (this.HELVETICA[character] || 556) / 1000;
  }

  static width(text, fontSize = 13, mode = 'mono') {
    return [...String(text || '')].reduce((total, character) => total + this.unit(character, mode) * fontSize, 0);
  }

  static positionAtOffset(text, offset, fontSize = 13, mode = 'mono') {
    const value = String(text || ''); const target = Math.max(0, Math.round(Number(offset) || 0));
    return this.width(value.slice(0, target), fontSize, mode)
      + Math.max(0, target - value.length) * this.unit(' ', mode) * fontSize;
  }

  static offsetAtWidth(text, width, fontSize = 13, mode = 'mono') {
    const value = String(text || ''); const target = Math.max(0, Number(width) || 0);
    let position = 0;
    for (let index = 0; index < value.length; index += 1) {
      const next = position + this.unit(value[index], mode) * fontSize;
      if (target < (position + next) / 2) return index;
      position = next;
    }
    const space = this.unit(' ', mode) * fontSize;
    return value.length + Math.max(0, Math.round((target - position) / space));
  }

  static fitEnd(text, start, maxWidth, fontSize = 13, mode = 'mono', extent = null) {
    const value = String(text || ''); const limit = Math.max(value.length, Number(extent) || 0);
    let width = 0; let index = Math.max(0, Number(start) || 0);
    while (index < limit) {
      const character = index < value.length ? value[index] : ' ';
      const next = width + this.unit(character, mode) * fontSize;
      if (next > maxWidth && index > start) break;
      width = next; index += 1;
    }
    return Math.max(Number(start) + 1, index);
  }

  static cssFamily(mode = 'mono') {
    return this.normalize(mode) === 'sans'
      ? 'Arial, Helvetica, sans-serif'
      : '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
  }
}

if (typeof window !== 'undefined') window.ChartTextMetrics = ChartTextMetrics;
if (typeof module !== 'undefined' && module.exports) module.exports = ChartTextMetrics;
