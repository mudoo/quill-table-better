const path = require('node:path');
const { test: base, expect } = require('@playwright/test');

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<main></main><input id="outside" value="outside">');
    await page.addStyleTag({ path: require.resolve('quill/dist/quill.snow.css') });
    const fixture = path.resolve(__dirname, '../.test-build', testInfo.project.name);
    await page.addStyleTag({ path: path.join(fixture, 'quill-table-better.css') });
    await page.addScriptTag({ path: require.resolve('quill/dist/quill.js') });
    await page.addScriptTag({ path: path.join(fixture, 'quill-table-better.js') });
    await page.evaluate(() => {
      Quill.register({ 'modules/table-better': QuillTableBetter }, true);
      window.editors = [];
      window.createEditor = (html = '', modules = {}, width = 600) => {
        const container = document.createElement('div');
        container.style.width = `${width}px`;
        document.querySelector('main').appendChild(container);
        const quill = new Quill(container, {
          theme: 'snow',
          modules: {
            table: false,
            toolbar: [['bold', 'italic'], [{ header: [1, 2, false] }], [{ list: 'bullet' }]],
            'table-better': { language: 'en_US' },
            keyboard: { bindings: QuillTableBetter.keyboardBindings },
            ...modules
          }
        });
        if (html) quill.updateContents(quill.clipboard.convert({ html }), 'api');
        quill.history.clear();
        editors.push(quill);
        return quill;
      };
    });
    await use(page);
    await page.evaluate(() => editors.forEach(quill => quill.getModule('table-better')?.destroy()));
    expect(errors).toEqual([]);
  }
});

module.exports = { test, expect };
