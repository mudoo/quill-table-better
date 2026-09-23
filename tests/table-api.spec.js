const { test, expect } = require('./helpers');

test('inline formats in TH preserve line boundaries and round-trip through Delta', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<table><thead><tr><th>A<strong>B</strong><a href="https://example.com"><span style="color: rgb(10, 20, 30)">C</span></a></th><th><p>D<em>E</em></p><p>F</p></th></tr></thead></table>');
    const saved = quill.getContents();
    quill.setContents(saved);
    return { cells: [...quill.root.querySelectorAll('th')].map(cell => [cell.textContent, cell.querySelectorAll('p').length]), bold: quill.root.querySelector('strong').textContent, link: quill.root.querySelector('a').textContent, saved, after: quill.getContents() };
  });
  expect(result.cells).toEqual([['ABC', 1], ['DEF', 2]]);
  expect(result.bold).toBe('B');
  expect(result.link).toBe('C');
  expect(result.after).toEqual(result.saved);
});

for (const format of ['header', 'list', 'thead']) {
  test(`table APIs recognize ${format} cells and prevent nested insertion`, async ({ page }) => {
    const result = await page.evaluate(format => {
      const quill = createEditor(format === 'thead' ? '<table><thead><tr><th>HEAD</th></tr></thead></table>' : '<table><tr><td>BODY</td></tr></table>');
      const module = quill.getModule('table-better');
      const cell = Quill.find(quill.root.querySelector('td,th'));
      const index = cell.offset(quill.scroll);
      if (format !== 'thead') quill.formatLine(index, 1, format, format === 'header' ? 2 : 'bullet', 'api');
      quill.setSelection(index + 1);
      const [table, row, found] = module.getTable();
      const foundText = found?.domNode.textContent;
      module.showTools();
      const selected = module.cellSelection.selectedTds.length;
      module.insertTable(2, 2);
      const count = quill.root.querySelectorAll('table').length;
      module.deleteTable();
      return { found: !!(table && row && found), foundText, selected, count, deleted: !quill.root.querySelector('table') };
    }, format);
    expect(result).toEqual({ found: true, foundText: format === 'thead' ? 'HEAD' : 'BODY', selected: 1, count: 1, deleted: true });
  });
}
