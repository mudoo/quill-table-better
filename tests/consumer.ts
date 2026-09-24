import Quill from 'quill';
import QuillTableBetter, { Options } from '..';

const options: Options = {
  language: 'en_US',
  toolbarTable: true,
  menus: [{ name: 'column', icon: '<span>Columns</span>' }, 'row', 'cell']
};

Quill.register({ 'modules/table-better': QuillTableBetter }, true);
const quill = new Quill(document.createElement('div'));
const table = new QuillTableBetter(quill, options);
table.getTable();
table.destroy();
