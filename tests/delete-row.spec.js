const { test, expect } = require('./helpers');

for (const section of ['thead', 'tbody']) {
  test(`deleting the only ${section} row preserves the other section`, async ({ page }) => {
    const result = await page.evaluate(section => {
      const quill = createEditor('<table><thead><tr><th>HEAD1</th><th>HEAD2</th></tr></thead><tbody><tr><td>BODY1</td><td>BODY2</td></tr></tbody></table>');
      const module = quill.getModule('table-better');
      const cells = [...quill.root.querySelectorAll(`${section} th, ${section} td`)];
      module.cellSelection.setSelectedTds(cells);
      module.tableMenus.updateTable(quill.root.querySelector('table'));
      module.tableMenus.deleteRow();
      quill.update('user');
      return [...quill.root.querySelectorAll('td,th')].map(cell => cell.textContent);
    }, section);
    expect(result).toEqual(section === 'thead' ? ['BODY1', 'BODY2'] : ['HEAD1', 'HEAD2']);
  });
}

test('deleting consecutive rows moves spanning cells to the first surviving row', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<table><tr><td rowspan="4"><p>KEEP</p><p>SECOND</p></td><td>A</td><td rowspan="3">RIGHT</td></tr><tr><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td></tr></table>');
    const table = Quill.find(quill.root.querySelector('table'));
    const rows = [...quill.root.querySelectorAll('tr')].map(row => Quill.find(row));
    table.deleteRow(rows.slice(0, 2), () => table.remove());
    quill.update('user');
    const after = [...quill.root.querySelectorAll('tr')].map(row => [...row.cells].map(cell => [cell.textContent, cell.rowSpan]));
    quill.history.undo();
    const undo = quill.root.querySelectorAll('tr').length;
    quill.history.redo();
    return { after, undo, redo: quill.root.querySelectorAll('tr').length };
  });
  expect(result).toEqual({ after: [[['KEEPSECOND', 2], ['C', 1], ['RIGHT', 1]], [['D', 1], ['E', 1]]], undo: 4, redo: 2 });
});

test('deleting middle rows shrinks rowspans and only removes the table when all rows are selected', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<table><tr><td rowspan="3">KEEP</td><td>A</td></tr><tr><td>B</td></tr><tr><td>C</td></tr></table>');
    const table = Quill.find(quill.root.querySelector('table'));
    const rows = [...quill.root.querySelectorAll('tr')].map(row => Quill.find(row));
    table.deleteRow([rows[1], rows[1]], () => table.remove());
    quill.update('user');
    const span = quill.root.querySelector('td').rowSpan;
    const remaining = [...quill.root.querySelectorAll('tr')].map(row => Quill.find(row));
    table.deleteRow(remaining, () => table.remove());
    quill.update('user');
    return { span, tables: quill.root.querySelectorAll('table').length };
  });
  expect(result).toEqual({ span: 2, tables: 0 });
});
