const { test, expect } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    // Dialogs often have a focusable ancestor outside the Quill container.
    const host = document.querySelector('main');
    host.tabIndex = -1;
    host.style.minHeight = '600px';
    window.quill = createEditor('<table style="width:100%"><tr><td>ONE</td><td>TWO</td></tr><tr><td>THREE</td><td>FOUR</td></tr></table>');
  });
  await page.locator('.ql-editor td').first().click();
  await expect(page.locator('.ql-table-menus-container')).toBeVisible();
});

test('table menus retain focus while inserting rows and columns inside a focusable host', async ({ page }) => {
  await page.locator('[data-category="row"] > .ql-table-tooltip-hover').click();
  await expect(page.locator('.ql-editor')).toBeFocused();
  await page.getByText('Insert row below', { exact: true }).click();
  await expect(page.locator('.ql-editor tr')).toHaveCount(3);

  await page.locator('[data-category="column"] > .ql-table-tooltip-hover').click();
  await page.getByText('Insert column right', { exact: true }).click();
  await expect(page.locator('.ql-editor td')).toHaveCount(9);
  await expect(page.locator('.ql-table-menus-container')).toBeVisible();
});

for (const category of ['cell', 'table']) {
  test(`${category} properties keep inputs, dropdowns and colors usable inside a focusable host`, async ({ page }) => {
    await page.locator(`[data-category="${category}"] > .ql-table-tooltip-hover`).click();
    const form = page.locator('.ql-table-properties-form');
    await expect(form).toBeVisible();

    const height = form.getByPlaceholder('Height', { exact: true });
    await height.click();
    await expect(height).toBeFocused();
    await height.fill('60');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Backspace');
    await expect(height).toHaveValue('');
    await page.keyboard.press('Control+v');
    await expect(height).toHaveValue('60');
    await expect(page.locator('.ql-editor td')).toHaveText(['ONE', 'TWO', 'THREE', 'FOUR']);

    await form.locator('.ql-table-dropdown-properties').click();
    await form.getByText('dashed', { exact: true }).click();
    await expect(height).toBeFocused();

    const background = form.locator('.ql-table-color-container').last();
    await background.locator('.color-button').click();
    await background.locator('[data-color="#ff0000"]').click();
    await expect(background.locator('input')).toHaveValue('#ff0000');
    await expect(height).toBeFocused();
    await background.locator('.color-button').click();
    const pickerButton = background.getByRole('button', { name: 'Color picker', exact: true });
    await pickerButton.click();
    await expect(pickerButton).toBeFocused();
    await background.locator('.IroWheel').click({ position: { x: 75, y: 55 } });
    await background.locator('.color-picker-palette button[label="save"] span').click();
    const color = await background.locator('input').inputValue();
    expect(color).toMatch(/^#[\da-f]{6}$/i);
    expect(color).not.toBe('#ff0000');

    await form.locator(':scope > .properties-form-action-row > button[label="save"] span').last().click();
    await expect(form).toHaveCount(0);
    await expect(page.locator('.ql-table-menus-container')).toBeVisible();
    const saved = await page.evaluate(category => {
      quill.update();
      const target = quill.root.querySelector(category === 'cell' ? 'td' : 'table');
      return { height: target.style.height, border: target.style.borderStyle, background: target.style.backgroundColor };
    }, category);
    expect(saved.height).toBe('60px');
    expect(saved.border).toBe('dashed');
    const expectedColor = await page.evaluate(color => {
      const element = document.createElement('span');
      element.style.backgroundColor = color;
      return element.style.backgroundColor;
    }, color);
    expect(saved.background).toBe(expectedColor);
  });
}

test('multi-cell drag selection survives menu interaction and merges the selected cells', async ({ page }) => {
  const first = await page.locator('.ql-editor td').nth(0).boundingBox();
  const second = await page.locator('.ql-editor td').nth(1).boundingBox();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => quill.getModule('table-better').cellSelection.selectedTds.length)).toBe(2);
  await expect(page.locator('.ql-editor')).not.toBeFocused();

  await page.locator('[data-category="merge"] > .ql-table-tooltip-hover').click();
  await page.locator('[data-category="merge"] li').filter({ hasText: 'Merge cells' }).click();
  await expect(page.locator('.ql-editor td')).toHaveCount(3);
  await expect(page.locator('.ql-editor td').first()).toHaveAttribute('colspan', '2');
  await expect(page.locator('.ql-editor td').first()).toHaveText('ONETWO');
});

test('multi-cell properties apply to all selected cells after focus moves into the form', async ({ page }) => {
  await page.locator('[data-category="row"] > .ql-table-tooltip-hover').click();
  await page.getByText('Select row', { exact: true }).click();
  expect(await page.evaluate(() => quill.getModule('table-better').cellSelection.selectedTds.length)).toBe(2);
  await page.locator('[data-category="cell"] > .ql-table-tooltip-hover').click();
  const form = page.locator('.ql-table-properties-form');
  const padding = form.getByPlaceholder('Padding', { exact: true });
  await padding.click();
  await padding.fill('12');
  await form.locator('[data-align="center"]').click();
  await expect(padding).toBeFocused();
  await form.locator(':scope > .properties-form-action-row > button[label="save"]').click();
  await expect(page.locator('.ql-editor tr').first().locator('.ql-align-center')).toHaveCount(2);
  expect(await page.locator('.ql-editor td').evaluateAll(cells => cells.map(cell => cell.style.padding))).toEqual(['12px', '12px', '', '']);
});

for (const leave of ['pointer', 'tab', 'focus', 'host']) {
  test(`leaving table properties via ${leave} still clears selection and preserves external editing`, async ({ page }) => {
    await page.locator('[data-category="cell"] > .ql-table-tooltip-hover').click();
    const form = page.locator('.ql-table-properties-form');
    await form.getByPlaceholder('Height', { exact: true }).click();
    const outside = page.locator('#outside');
    if (leave === 'pointer') await outside.click();
    if (leave === 'tab') {
      await form.locator(':scope > .properties-form-action-row > button[label="cancel"]').focus();
      await page.keyboard.press('Tab');
    }
    if (leave === 'focus') await outside.focus();
    if (leave === 'host') await page.locator('main').click({ position: { x: 650, y: 550 } });
    await expect(form).toHaveCount(0);
    await expect(page.locator('.ql-table-menus-container')).toBeHidden();
    expect(await page.evaluate(() => quill.getModule('table-better').cellSelection.selectedTds.length)).toBe(0);

    if (leave === 'host') await outside.click();
    await expect(outside).toBeFocused();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Backspace');
    await expect(outside).toHaveValue('');
    await page.keyboard.press('Control+v');
    await expect(outside).toHaveValue('outside');
    await expect(page.locator('.ql-editor td')).toHaveText(['ONE', 'TWO', 'THREE', 'FOUR']);
  });
}
