import Quill from 'quill';
import type { Blot } from 'parchment';
import type {
  CorrectBound,
  Props,
  TableCellChildren,
  TableContainer
} from '../types';
import {
  TableCell,
  TableTh,
  TableCellBlock,
  TableCol
} from '../formats/table';
import TableList, { ListContainer } from '../formats/list';
import TableHeader from '../formats/header';
import { COLORS, DEVIATION } from '../config';

function addDimensionsUnit(value: string) {
  if (!value) return value;
  const unit = value.replace(/\d+\.?\d*/, ''); // 'px' or 'em' or '%'
  if (!unit) return value + 'px';
  return value;
}

function convertUnitToInteger(withUnit: string) {
  if (
    typeof withUnit !== 'string' ||
    !withUnit ||
    withUnit.endsWith('%')
  ) return withUnit;
  const unit = withUnit.replace(/\d+\.?\d*/, ''); // 'px' or 'em' or '%'
  const numberPart = withUnit.slice(0, -unit.length);
  const integerPart = Math.round(parseFloat(numberPart));
  return `${integerPart}${unit}`;
}

function createTooltip(content: string) {
  const element = document.createElement('div');
  element.innerText = content;
  element.classList.add('ql-table-tooltip', 'ql-hidden');
  return element;
}

function debounce(cb: Function, delay: number) {
  let timer: NodeJS.Timeout = null;
  return function () {
    let context = this;
    let args = arguments;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function () {
      cb.apply(context, args);
    }, delay);
  }
}

function filterWordStyle(s: string) {
  return s.replace(/mso.*?;/g, '');
}

function getAlign(cellBlot: TableCell) {
  const DEFAULT = 'left';
  let align = null;
  const blocks = cellBlot.descendants(TableCellBlock);
  const lists = cellBlot.descendants(TableList);
  const headers = cellBlot.descendants(TableHeader);
  function getChildAlign(child: TableCellChildren): string {
    for (const name of child.domNode.classList) {
      if (/ql-align-/.test(name)) {
        return name.split('ql-align-')[1];
      }
    }
    return DEFAULT;
  }
  function isSameValue(prev: string | null, cur: string) {
    if (prev == null) return true;
    return prev === cur;
  }
  for (const child of [...blocks, ...lists, ...headers]) {
    const _align = getChildAlign(child);
    if (isSameValue(align, _align)) {
      align = _align;
    } else {
      return DEFAULT;
    }
  }
  return align != null ? align : DEFAULT;
}

function getCellChildBlot(cellBlot: TableCell) {
  // @ts-expect-error
  const [block] = cellBlot.descendant(TableCellBlock);
  // @ts-expect-error
  const [list] = cellBlot.descendant(ListContainer);
  // @ts-expect-error
  const [header] = cellBlot.descendant(TableHeader);
  return block || list || header;
}

function getCellFormats(cellBlot: TableCell): [Props, string] {
  const formats = TableCell.formats(cellBlot.domNode);
  const childBlot = getCellChildBlot(cellBlot);
  if (!childBlot) {
    const row = formats['data-row'].split('-')[1];
    return [formats, `cell-${row}`];
  } else {
    const _formats = childBlot.formats()[childBlot.statics.blotName];
    const cellId = getCellId(_formats);
    return [formats, cellId];
  }
}

function getCellId(formats: string | Props) {
  return formats instanceof Object ? formats['cellId'] : formats;
}

function getClosestElement(element: HTMLElement, selector: string) {
  return element.closest(selector);
}

function getComputeBounds(startCorrectBounds: CorrectBound, endCorrectBounds: CorrectBound) {
  const left = Math.min(startCorrectBounds.left, endCorrectBounds.left);
  const right = Math.max(startCorrectBounds.right, endCorrectBounds.right);
  const top = Math.min(startCorrectBounds.top, endCorrectBounds.top);
  const bottom = Math.max(startCorrectBounds.bottom, endCorrectBounds.bottom);
  return { left, right, top, bottom }
}

function getComputeSelectedCols(
  computeBounds: CorrectBound,
  table: Element,
  container: Element
) {
  const tableParchment = Quill.find(table) as TableContainer;
  const cols = tableParchment.descendants(TableCol);
  let correctLeft = 0;
  return cols.reduce((selectedCols: Element[], col: TableCol) => {
    const { left, width } = getCorrectBounds(col.domNode, container);
    correctLeft = correctLeft ? correctLeft : left;
    if (
      correctLeft + DEVIATION >= computeBounds.left &&
      correctLeft - DEVIATION + width <= computeBounds.right
    ) {
      selectedCols.push(col.domNode);
    }
    correctLeft += width;
    return selectedCols;
  }, []);
}

function getComputeSelectedTds(
  computeBounds: CorrectBound,
  table: Element,
  container: Element,
  type?: string
): Element[] {
  const tableParchment = Quill.find(table) as TableContainer;
  const tableCells = tableParchment.descendants(TableCell);
  return tableCells.reduce((selectedTds: Element[], tableCell: TableCell) => {
    const { left, top, width, height } = getCorrectBounds(tableCell.domNode, container);
    switch (type) {
      case 'column':
        if (
          left + DEVIATION >= computeBounds.left &&
          left - DEVIATION + width <= computeBounds.right
        ) {
          selectedTds.push(tableCell.domNode);
        } else if (
          left + DEVIATION < computeBounds.right &&
          computeBounds.right < left - DEVIATION + width
        ) {
          selectedTds.push(tableCell.domNode);
        } else if (
          computeBounds.left > left + DEVIATION &&
          computeBounds.left < left - DEVIATION + width
        ) {
          selectedTds.push(tableCell.domNode);
        }
        break;
      case 'row':
        break;
      default:
        if (
          left + DEVIATION >= computeBounds.left &&
          left - DEVIATION + width <= computeBounds.right &&
          top + DEVIATION >= computeBounds.top &&
          top - DEVIATION + height <= computeBounds.bottom
        ) {
          selectedTds.push(tableCell.domNode);
        }
        break;
    }
    return selectedTds;
  }, []);
}

function getCopyTd(html: string) {
  return html
  .replace(/data-(?!list)[a-z]+="[^"]*"/g, '')
  .replace(/class="[^"]*"/g, collapse => {
    return collapse
      .replace(/ql-cell-[^"]*/g, '')
      .replace(/ql-table-[^"]*/, '')
      .replace(/table-list(?:[^"]*)?/g, '');
  })
  .replace(/class="\s*"/g, '');
}

function getCorrectBounds(target: Element, container: Element = target) {
  const targetBounds = target.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  const left = targetBounds.left - containerBounds.left - container.scrollLeft;
  const top = targetBounds.top - containerBounds.top - container.scrollTop;
  const width = targetBounds.width;
  const height = targetBounds.height;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height
  }
}

function getCorrectCellBlot(blot: Blot | null): TableCell | null {
  while (blot) {
    if (
      blot.statics.blotName === TableCell.blotName ||
      blot.statics.blotName === TableTh.blotName
    ) {
      return blot as TableCell;
    }
    blot = blot.parent;
  }
  return null;
}

function getCorrectContainerWidth(container: HTMLElement) {
  const { clientWidth } = container;
  const computedStyle = getComputedStyle(container);
  const pl = parseFloat(computedStyle.paddingLeft) || 0;
  const pr = parseFloat(computedStyle.paddingRight) || 0;
  const w = Math.max(0, clientWidth - pl - pr);
  return w;
}

function getCorrectWidth(width: number, isPercent: boolean, referenceWidth: number) {
  if (!isPercent || referenceWidth <= 0) return `${width}px`;
  return `${((width / referenceWidth) * 100).toFixed(2)}%`;
}

function getElementStyle(node: HTMLElement, rules: string[]) {
  const computedStyle = getComputedStyle(node);
  const style = node.style;
  return rules.reduce((styles: Props, rule: string) => {
    styles[rule] = rgbToHex(
      style.getPropertyValue(rule) ||
      computedStyle.getPropertyValue(rule)
    );
    return styles;
  }, {});
}

function isDimensions(key: string) {
  if (key.endsWith('width') || key.endsWith('height')) return true;
  return false;
}

function isSimpleColor(color: string) {
  for (const col of COLORS) {
    if (col === color) return true;
  }
  return false;
}

function isValidColor(color: string) {
  if (!color) return true;
  const hexRegex = /^#(?:[a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i;
  return hexRegex.test(color) || isSimpleColor(color) || color === 'transparent' ||
    (/^rgba?\(/i.test(color) && CSS.supports('color', color));
}

function isValidDimensions(value: string) {
  if (!value) return true;
  const unit = value.replace(/\d+\.?\d*/, ''); // 'px' or 'em' or '%'
  if (!unit) return true;
  if (unit !== 'px' && unit !== 'em' && unit !== '%') {
    return !/[a-z]/.test(unit) && !isNaN(parseFloat(unit));
  }
  return true;
}

function isValidPadding(value: string) {
  if (!value) return true;
  const parts = value.trim().split(/\s+/);
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every(part => isValidDimensions(part));
}

function preserveFocusOnMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const container = e.currentTarget as HTMLElement;
  const control = (e.target as Element).closest(
    'input, textarea, select, button, a[href], [tabindex], [contenteditable]:not([contenteditable="false"])'
  );
  // Only controls inside this panel should move focus. A focusable host would
  // otherwise clear the table selection before a menu item's click can run.
  if (!control || !container.contains(control)) e.preventDefault();
}

function removeElementProperty(node: HTMLElement, properties: string[]) {
  for (const property of properties) {
    node.style.removeProperty(property);
  }
}

function rgbToHex(value: string) {
  if (value === 'transparent') return '#00000000';
  const match = /^rgba?\((.*)\)$/i.exec(value.trim());
  if (!match) return value;
  const channels = match[1].trim().split(/[\s,/]+/);
  if (channels.length < 3 || channels.length > 4 ||
    channels.some(channel => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(channel))) return value;
  const hex = channels.map((channel, index) => {
    const scale = channel.endsWith('%') ? 255 / 100 : index === 3 ? 255 : 1;
    const byte = Math.round(Math.min(255, Math.max(0, parseFloat(channel) * scale)));
    return byte.toString(16).padStart(2, '0');
  }).join('');
  return `#${hex}`;
}

function setElementAttribute(node: Element, attributes: Props) {
  for (const attribute in attributes) {
    node.setAttribute(attribute, attributes[attribute]);
  }
}

function setElementProperty(node: HTMLElement, properties: Props) {
  const style = node.style;
  if (!style) {
    node.setAttribute('style', properties.toString());
    return;
  }
  for (const propertyName in properties) {
    style.setProperty(propertyName, properties[propertyName]);
  }
}

function throttle(cb: Function, delay: number) {
  let last = 0
  return function () {
    let context = this;
    let args = arguments;
    let now = +new Date();
    if (now - last >= delay) {
      last = now;
      cb.apply(context, args);
    }
  }
}

function throttleStrong(cb: Function, delay: number) {
  let last = 0, timer: NodeJS.Timeout = null;
  return function () {
    let context = this;
    let args = arguments;
    let now = +new Date();
    if (now - last < delay) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        last = now;
        cb.apply(context, args);
      }, delay);
    } else {
      last = now;
      cb.apply(context, args);
    }
  }
}

function updateTableWidth(
  table: HTMLElement,
  tableBounds: CorrectBound,
  change: number,
  editor: HTMLElement
) {
  const tableBlot = Quill.find(table) as TableContainer;
  if (!tableBlot) return;
  const isPercent = tableBlot.isPercent();
  if (isPercent && !change) return;
  const colgroup = tableBlot.colgroup();
  const target = tableBlot.temporary()?.domNode || table;
  // A table is relative to its editor; column and cell percentages are relative
  // to the table. Summing column percentages cannot determine the table width.
  if (isPercent) {
    setElementProperty(target, {
      width: getCorrectWidth(tableBounds.width + change, true, getCorrectContainerWidth(editor))
    });
    return;
  }
  if (colgroup) {
    let width = 0;
    const cols = colgroup.domNode.querySelectorAll('col');
    for (const col of cols) width += parseFloat(col.getAttribute('width')) || 0;
    setElementProperty(target, { width: `${width}px` });
  } else {
    setElementProperty(target, {
      width: `${tableBounds.width + change}px`
    });
  }
}

export {
  addDimensionsUnit,
  convertUnitToInteger,
  createTooltip,
  debounce,
  filterWordStyle,
  getAlign,
  getCellChildBlot,
  getCellFormats,
  getCellId,
  getClosestElement,
  getComputeBounds,
  getComputeSelectedCols,
  getComputeSelectedTds,
  getCopyTd,
  getCorrectBounds,
  getCorrectCellBlot,
  getCorrectContainerWidth,
  getCorrectWidth,
  getElementStyle,
  isDimensions,
  isValidColor,
  isValidDimensions,
  isValidPadding,
  preserveFocusOnMouseDown,
  removeElementProperty,
  rgbToHex,
  rgbToHex as rgbaToHex,
  setElementAttribute,
  setElementProperty,
  throttle,
  throttleStrong,
  updateTableWidth
};
