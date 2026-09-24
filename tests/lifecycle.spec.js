const { test, expect } = require('./helpers');

test('external keyboard editing clears a table selection without deleting cells', async ({ page }) => {
  await page.evaluate(() => {
    const quill = createEditor('<table><tr><td>ONE</td><td>TWO</td></tr></table>');
    quill.getModule('table-better').cellSelection.setSelectedTds([...quill.root.querySelectorAll('td')]);
    quill.blur();
  });
  await page.locator('#outside').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await expect(page.locator('#outside')).toHaveValue('outsid');
  await expect(page.locator('td')).toHaveText(['ONE', 'TWO']);
  expect(await page.evaluate(() => editors[0].getModule('table-better').cellSelection.selectedTds.length)).toBe(0);
});

for (const state of ['disabled', 'detached', 'destroyed']) {
  test(`${state} editors ignore global clipboard and delete events`, async ({ page }) => {
    const result = await page.evaluate(async state => {
      const quill = createEditor('<table><tr><td>ONE</td><td>TWO</td></tr></table>');
      const module = quill.getModule('table-better');
      const cells = [...quill.root.querySelectorAll('td')];
      module.cellSelection.setSelectedTds(cells);
      module.tableMenus.updateMenus(quill.root.querySelector('table'));
      if (state === 'disabled') quill.disable();
      if (state === 'detached') quill.container.remove();
      if (state === 'destroyed') {
        module.destroy();
        module.destroy();
        module.cellSelection.setSelectedTds(cells);
      }
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
      const data = new DataTransfer();
      data.setData('text/html', '<table><tr><td>NEW</td></tr></table>');
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      await new Promise(requestAnimationFrame);
      return { cells: cells.map(cell => cell.textContent), menuConnected: module.tableMenus.root.isConnected };
    }, state);
    expect(result.cells).toEqual(['ONE', 'TWO']);
    if (state === 'destroyed') expect(result.menuConnected).toBe(false);
  });
}
