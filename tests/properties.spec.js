const { test, expect } = require('./helpers');

test('cell properties parse transparent and fractional RGBA channels', async ({ page }) => {
  const result = await page.evaluate(() => {
    const quill = createEditor('<table><tr><td>A</td></tr></table>');
    const td = quill.root.querySelector('td');
    const menus = quill.getModule('table-better').tableMenus;
    return ['rgba(100, 150, 200, 0.5)', 'rgba(0, 0, 0, 0)', 'rgb(100, 150, 200)', 'rgba(300, -10, 200, 1)', 'rgb(100% 0% 0% / 25%)'].map(color => {
      td.style.backgroundColor = color;
      return menus.getSelectedTdAttrs(td)['background-color'];
    });
  });
  expect(result).toEqual(['#6496c880', '#00000000', '#6496c8', '#ff00c8', '#ff000040']);
});

test('the properties form edits and saves alpha without rejecting eight-digit hex', async ({ page }) => {
  await page.evaluate(() => {
    window.quill = createEditor('<table><tr><td style="background-color:rgba(100,150,200,0.5)">A</td></tr></table>');
  });
  await page.locator('.ql-editor td').click();
  await page.locator('[data-category="cell"]').click();
  const input = page.locator('input[placeholder="Color"]').last();
  await expect(input).toHaveValue('#6496c880');
  await input.fill('#10203040');
  const background = page.locator('.ql-table-color-container').last();
  await background.locator('.color-button').click();
  await background.getByRole('button', { name: 'Color picker', exact: true }).click();
  await background.locator('.color-picker-palette button[label="save"]').click();
  await expect(input).toHaveValue('#10203040');
  const save = page.locator('.properties-form-action-row > button[label="save"]').last();
  await expect(save).toBeEnabled();
  await save.click();
  expect(await page.evaluate(() => {
    quill.update();
    return quill.getModule('table-better').tableMenus.getSelectedTdAttrs(quill.root.querySelector('td'))['background-color'];
  })).toBe('#10203040');
});

test('percentage column widths use the owning table in differently sized editors', async ({ page }) => {
  const result = await page.evaluate(() => {
    const html = '<table style="width:100%"><colgroup><col width="100"><col width="100"></colgroup><tr><td>A</td><td>B</td></tr></table>';
    createEditor(html, {}, 600);
    const quill = createEditor(html, {}, 320);
    const module = quill.getModule('table-better');
    const table = quill.root.querySelector('table');
    const col = table.querySelector('col');
    const contentWidth = quill.root.clientWidth - 30;
    module.operateLine.setColWidth(col, `${contentWidth / 2}`, true);
    const full = col.style.width;
    const blot = Quill.find(table);
    blot.temporary().domNode.style.width = '50%';
    quill.update();
    module.operateLine.setColWidth(col, `${table.getBoundingClientRect().width / 2}`, true);
    const half = col.style.width;
    quill.update();
    const saved = quill.getContents();
    quill.setContents(saved);
    return { full, half, restored: quill.root.querySelector('col').getAttribute('width'), first: editors[0].root.querySelector('col').style.width };
  });
  expect(parseFloat(result.full)).toBeCloseTo(50, 0);
  expect(result.half).toBe('50%');
  expect(result.restored).toBe('50.00%');
  expect(result.first).toBe('');
});

for (const colgroup of [true, false]) {
  test(`resizing a percentage table preserves its own editor basis (colgroup ${colgroup})`, async ({ page }) => {
    const result = await page.evaluate(colgroup => {
      createEditor('<p>First</p>', {}, 600);
      const quill = createEditor(`<table style="width:50%">${colgroup ? '<colgroup><col width="50"><col width="50"></colgroup>' : ''}<tr><td>A</td><td>B</td></tr></table>`, {}, 320);
      quill.root.style.paddingLeft = '15.5px';
      quill.root.style.paddingRight = '12.5px';
      const table = quill.root.querySelector('table');
      const before = table.getBoundingClientRect().width;
      const editorWidth = quill.root.clientWidth - 28;
      quill.getModule('table-better').operateLine.setCellsRect(table.querySelector('td'), 24, 0);
      quill.update();
      const expected = (before + 24) / editorWidth * 100;
      return { expected, actual: parseFloat(table.style.width), widths: [...table.querySelectorAll(colgroup ? 'col' : 'td')].map(node => parseFloat(node.style.width)) };
    }, colgroup);
    expect(result.actual).toBeCloseTo(result.expected, 1);
    // Collapsed table borders contribute a pixel to the table's measured width.
    expect(Math.abs(result.widths.reduce((sum, width) => sum + width, 0) - 100)).toBeLessThan(1);
  });
}
