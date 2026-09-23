const { test, expect } = require('./helpers');

test('setContents replaces existing content and round-trips table Deltas repeatedly', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<p>Before</p><table><thead><tr><th>HEAD</th><th>SECOND</th></tr></thead><tbody><tr><td><p>A</p><p>B</p></td><td>C</td></tr></tbody></table><p>After</p>');
    const before = quill.getContents();
    for (let i = 0; i < 3; i++) quill.setContents(before, 'api');
    const after = quill.getContents();
    const cells = [...quill.root.querySelectorAll('td,th')].map(cell => cell.textContent);
    const target = createEditor('<p>OLD</p>');
    target.setContents(before, 'api');
    const targetDelta = target.getContents();
    quill.setText('plain', 'api');
    return { before, after, targetDelta, cells, plain: quill.getText(), tables: quill.root.querySelectorAll('table').length };
  });
  expect(result.after).toEqual(result.before);
  expect(result.targetDelta).toEqual(result.before);
  expect(result.cells).toEqual(['HEAD', 'SECOND', 'AB', 'C']);
  expect(result.plain).toBe('plain\n');
  expect(result.tables).toBe(0);
});

test('setContents preserves formatted cells, embeds, history and event sources', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<table><tr><td><p>Title</p><p><strong>Bold</strong><img src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" /></p></td><td><p>One</p><p>Two</p></td></tr></table>');
    const cells = quill.root.querySelectorAll('td');
    quill.formatLine(Quill.find(cells[0]).offset(quill.scroll), 1, 'header', 2, 'api');
    quill.formatLine(Quill.find(cells[1]).offset(quill.scroll), 1, 'list', 'bullet', 'api');
    const saved = quill.getContents();
    quill.setText('old');
    quill.history.clear();
    const events = [];
    quill.on('text-change', (delta, old, source) => events.push(source));
    quill.setContents(saved, 'user');
    const after = quill.getContents();
    const sources = events.slice();
    quill.history.undo();
    const undo = quill.getText();
    quill.history.redo();
    const redo = quill.getContents();
    return { saved, after, sources, undo, redo, headers: quill.root.querySelectorAll('h2').length, lists: quill.root.querySelectorAll('li').length };
  });
  expect(result.after).toEqual(result.saved);
  expect(result.redo).toEqual(result.saved);
  expect(result.sources).toEqual(['user']);
  expect(result.undo).toBe('old\n');
  expect(result.headers).toBe(1);
  expect(result.lists).toBeGreaterThan(0);
});
