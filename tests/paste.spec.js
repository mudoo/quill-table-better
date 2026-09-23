const { test, expect } = require('./helpers');

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
    const quill = createEditor('<table><tr><td><p>OLD1</p><p>OLD2</p></td></tr></table>');
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
