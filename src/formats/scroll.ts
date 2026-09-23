import Quill from 'quill';
import Delta from 'quill-delta';
import type ScrollBlot from 'quill/blots/scroll';

const Scroll = Quill.import('blots/scroll') as typeof ScrollBlot;

class TableScroll extends Scroll {
  insertContents(index: number, delta: Delta) {
    const hasTable = delta.ops.some(op =>
      Object.keys(op.attributes || {}).some(name => name.startsWith('table-'))
    );
    if (!hasTable) return super.insertContents(index, delta);

    // Quill's bulk insertion chooses one block format per line, losing the
    // cell/list containers. Its first-line path applies every format in order.
    // Insert complete lines through that path without changing setContents'
    // replacement, history or source semantics.
    let line = new Delta();
    for (const op of delta.ops) {
      if (typeof op.insert !== 'string') {
        line.push(op);
        continue;
      }
      let start = 0;
      for (let end = op.insert.indexOf('\n'); end !== -1; end = op.insert.indexOf('\n', start)) {
        line.insert(op.insert.slice(start, end + 1), op.attributes);
        super.insertContents(index, line);
        index += line.length();
        line = new Delta();
        start = end + 1;
      }
      if (start < op.insert.length) line.insert(op.insert.slice(start), op.attributes);
    }
    if (line.length()) super.insertContents(index, line);
  }
}

export default TableScroll;
