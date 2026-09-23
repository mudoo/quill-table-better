const { test, expect } = require('./helpers');

test('batch headings and lists use the host Quill Parchment constructors', async ({ page }) => {
  await page.evaluate(() => {
    window.quill = createEditor('<table><tr><td>ONE</td><td>TWO</td></tr></table>');
    const module = quill.getModule('table-better');
    module.cellSelection.setSelectedTds([...quill.root.querySelectorAll('td')]);
    quill.blur();
  });
  await page.locator('.ql-header .ql-picker-label').click();
  await page.locator('.ql-header .ql-picker-item[data-value="1"]').click();
  await expect(page.locator('td h1')).toHaveText(['ONE', 'TWO']);
  await page.locator('.ql-list').click();
  await expect(page.locator('td li')).toHaveText(['ONE', 'TWO']);
});

test('plain editors retain default and custom toolbar handlers after registration', async ({ page }) => {
  await page.evaluate(() => {
    createEditor('<table><tr><td>TABLE</td></tr></table>');
    window.plain = createEditor('<p>Normal</p>', {
      'table-better': false,
      toolbar: {
        container: [['bold'], [{ header: [1, false] }], [{ list: 'bullet' }], ['clean']],
        handlers: { clean() { window.cleaned = true; this.quill.removeFormat(0, 6, 'user'); } }
      }
    });
    plain.setSelection(0, 6);
  });
  await page.locator('.ql-toolbar').nth(1).locator('.ql-bold').click();
  expect(await page.evaluate(() => plain.getFormat(0, 6).bold)).toBe(true);
  await page.locator('.ql-toolbar').nth(1).locator('.ql-header .ql-picker-label').click();
  await page.locator('.ql-toolbar').nth(1).locator('.ql-header .ql-picker-item[data-value="1"]').click();
  expect(await page.evaluate(() => plain.getFormat(0, 6).header)).toBe(1);
  await page.locator('.ql-toolbar').nth(1).locator('.ql-list').click();
  expect(await page.evaluate(() => plain.getFormat(0, 6).list)).toBe('bullet');
  await page.locator('.ql-toolbar').nth(1).locator('.ql-clean').click();
  expect(await page.evaluate(() => window.cleaned)).toBe(true);
  await expect(page.locator('td')).toHaveText('TABLE');
});
