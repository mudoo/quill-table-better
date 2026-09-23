const { test, expect } = require('./helpers');

for (const format of ['header', 'list', 'thead']) {
  test(`paste into ${format} cells is one change even with history delay zero`, async ({ page }) => {
    const result = await page.evaluate(format => {
      const html = format === 'thead' ? '<table><thead><tr><th>OLD1</th><th>OLD2</th></tr></thead></table>' : '<table><tr><td>OLD1</td><td>OLD2</td></tr></table>';
      const quill = createEditor(html, { history: { delay: 0 } });
      const module = quill.getModule('table-better');
      const index = Quill.find(quill.root.querySelector('td,th')).offset(quill.scroll);
      if (format !== 'thead') quill.formatLine(index, 1, format, format === 'header' ? 2 : 'bullet');
      module.cellSelection.setSelected(quill.root.querySelector('td,th'));
      quill.history.clear();
      const before = quill.getContents();
      let changes = 0;
      quill.on('text-change', () => changes++);
      const data = new DataTransfer();
      data.setData('text/html', '<table><tr><td><h2>NEW1</h2></td><td><ul><li>NEW2</li></ul></td></tr></table>');
      quill.root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      const cells = [...quill.root.querySelectorAll('td,th')].map(cell => cell.textContent);
      const heading = quill.root.querySelector('h2')?.textContent;
      const list = quill.root.querySelector('li')?.textContent;
      const pasteChanges = changes;
      quill.history.undo();
      // Rebuilding lists can serialize the implicit one-column/one-row spans.
      const normalize = delta => delta.ops.map(op => {
        for (const name of ['table-cell', 'table-th']) {
          for (const span of ['rowspan', 'colspan']) {
            if (op.attributes?.[name]?.[span] === '1') delete op.attributes[name][span];
          }
        }
        return op;
      });
      return { cells, heading, list, changes: pasteChanges, before: normalize(before), undo: normalize(quill.getContents()) };
    }, format);
    expect(result.cells).toEqual(['NEW1', 'NEW2']);
    expect(result.changes).toBe(1);
    expect(result.heading).toBe('NEW1');
    expect(result.list).toBe('NEW2');
    expect(result.undo).toEqual(result.before);
  });
}

test('native table paste overwrites cells and is isolated as one undo step', async ({ page }) => {
  await page.evaluate(() => {
    const source = document.createElement('div');
    source.id = 'copy-source';
    source.contentEditable = 'true';
    source.innerHTML = '<table><tr><td><strong>NEW_A</strong></td><td><p>NEW_B</p><p>LINE2</p></td></tr></table>';
    document.body.appendChild(source);
    source.focus();
    window.getSelection().selectAllChildren(source);
    window.quill = createEditor('<table><tr><td>CELL1</td><td>CELL2</td></tr><tr><td>KEEP1</td><td>KEEP2</td></tr></table>');
  });
  await page.keyboard.press('Control+c');
  await page.locator('.ql-editor td').first().click();
  await page.keyboard.press('Control+v');
  await expect(page.locator('.ql-editor td')).toHaveText(['NEW_A', 'NEW_BLINE2', 'KEEP1', 'KEEP2']);
  await expect(page.locator('.ql-editor td strong')).toHaveText('NEW_A');
  await page.evaluate(() => quill.history.undo());
  await expect(page.locator('.ql-editor td')).toHaveText(['CELL1', 'CELL2', 'KEEP1', 'KEEP2']);
  await page.evaluate(() => quill.history.redo());
  await expect(page.locator('.ql-editor td')).toHaveText(['NEW_A', 'NEW_BLINE2', 'KEEP1', 'KEEP2']);
});

test('paste can overwrite a multiline cell with empty content and extend the table', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<table><tr><td><p>OLD1</p><p>OLD2</p></td></tr></table>', { history: { delay: 0 } });
    const module = quill.getModule('table-better');
    module.cellSelection.setSelected(quill.root.querySelector('td'));
    const data = new DataTransfer();
    data.setData('text/html', '<table><tr><td></td><td>ADDED</td></tr><tr><td>ROW2</td><td>END</td></tr></table>');
    quill.root.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    const after = [...quill.root.querySelectorAll('td')].map(cell => cell.textContent);
    quill.history.undo();
    return { after, undo: [...quill.root.querySelectorAll('td')].map(cell => cell.textContent) };
  });
  expect(result.after).toEqual(['', 'ADDED', 'ROW2', 'END']);
  expect(result.undo).toEqual(['OLD1OLD2']);
});
