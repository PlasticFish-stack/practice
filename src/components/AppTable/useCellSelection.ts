import { onActivated, onBeforeUnmount, onDeactivated, onMounted, type Ref } from 'vue';
import type { SelectedCell } from './types';

/** A single rectangular range over rendered, visible cells, including tree rows. */
export function useCellSelection(
  root: Ref<HTMLElement | null>,
  enabled: () => boolean,
  changed: (cells: SelectedCell[]) => void,
) {
  let anchor: HTMLTableCellElement | null = null;
  let active: HTMLTableCellElement | null = null;
  let selected: HTMLTableCellElement[] = [];
  let dragging = false;
  const interactive =
    'button,a,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="button"],.el-checkbox,.el-switch,.el-table__expand-icon';
  function grid() {
    const table = root.value?.querySelector('.el-table');
    return Array.from(
      table?.querySelectorAll<HTMLTableRowElement>('.el-table__body > tbody > tr.el-table__row') ??
        [],
    )
      .filter((row) => row.closest('.el-table') === table && row.getClientRects().length)
      .map((row) => Array.from(row.cells));
  }
  function selectable(cell: HTMLTableCellElement) {
    return (
      !cell.classList.contains('app-cell-unselectable') && cell.colSpan === 1 && cell.rowSpan === 1
    );
  }
  function snapshot(): SelectedCell[] {
    const rows = grid();
    return selected.map((cell) => ({
      rowIndex: rows.findIndex((row) => row.includes(cell)),
      columnIndex: cell.cellIndex,
      text: cell.innerText.trim(),
    }));
  }
  function clear() {
    selected.forEach((cell) => {
      cell.classList.remove('is-cell-selected', 'is-cell-active');
      cell.removeAttribute('aria-selected');
    });
    selected = [];
    anchor = active = null;
    dragging = false;
    changed([]);
  }
  function choose(cell: HTMLTableCellElement, extend: boolean) {
    const rows = grid();
    if (!extend || !anchor || !rows.some((row) => row.includes(anchor!))) anchor = cell;
    const start = rows.findIndex((row) => row.includes(anchor!)),
      end = rows.findIndex((row) => row.includes(cell));
    if (start < 0 || end < 0) return;
    selected.forEach((item) => {
      item.classList.remove('is-cell-selected', 'is-cell-active');
      item.removeAttribute('aria-selected');
    });
    active = cell;
    const left = Math.min(anchor!.cellIndex, cell.cellIndex),
      right = Math.max(anchor!.cellIndex, cell.cellIndex);
    selected = rows
      .slice(Math.min(start, end), Math.max(start, end) + 1)
      .flatMap((row) => row.slice(left, right + 1).filter(selectable));
    selected.forEach((item) => {
      item.classList.add('is-cell-selected');
      item.setAttribute('aria-selected', 'true');
    });
    cell.classList.add('is-cell-active');
    changed(snapshot());
  }
  function hit(event: MouseEvent) {
    if (!enabled() || !(event.target instanceof Element) || event.target.closest(interactive))
      return null;
    const cell = event.target.closest<HTMLTableCellElement>('td');
    return cell && selectable(cell) && grid().some((row) => row.includes(cell)) ? cell : null;
  }
  function down(event: MouseEvent) {
    if (event.button !== 0) return;
    const cell = hit(event);
    if (!cell) return;
    event.preventDefault();
    root.value?.focus({ preventScroll: true });
    choose(cell, event.shiftKey);
    dragging = true;
  }
  function over(event: MouseEvent) {
    if (!dragging || !(event.buttons & 1)) return;
    const cell = hit(event);
    if (cell && cell !== active) choose(cell, true);
  }
  function keydown(event: KeyboardEvent) {
    if (
      !enabled() ||
      !active ||
      (event.target instanceof Element && event.target.closest(interactive))
    )
      return;
    if (event.key === 'Escape') {
      event.preventDefault();
      clear();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const offset = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[
      event.key
    ];
    if (!offset) return;
    event.preventDefault();
    const rows = grid(),
      rowIndex = rows.findIndex((row) => row.includes(active!));
    let r = rowIndex + offset[0]!,
      c = active.cellIndex + offset[1]!;
    while (rows[r]?.[c]) {
      const cell = rows[r]![c]!;
      if (selectable(cell)) {
        choose(cell, event.shiftKey);
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        break;
      }
      r += offset[0]!;
      c += offset[1]!;
    }
  }
  function copy(event: ClipboardEvent) {
    if (
      !enabled() ||
      !selected.length ||
      (event.target instanceof Element && event.target.closest(interactive))
    )
      return;
    const cells = snapshot(),
      lines = new Map<number, string[]>();
    cells.forEach((cell) => {
      const line = lines.get(cell.rowIndex) ?? [];
      line.push(cell.text.replace(/\t/g, ' ').replace(/\r?\n/g, ' '));
      lines.set(cell.rowIndex, line);
    });
    if (event.clipboardData) {
      event.clipboardData.setData(
        'text/plain',
        [...lines.values()].map((line) => line.join('\t')).join('\n'),
      );
      event.preventDefault();
    }
  }
  function up() {
    dragging = false;
  }
  function outside(event: MouseEvent) {
    if (event.target instanceof Node && !root.value?.contains(event.target) && selected.length)
      clear();
  }
  function attach() {
    document.addEventListener('mouseup', up);
    document.addEventListener('mousedown', outside);
    window.addEventListener('blur', up);
  }
  function detach() {
    up();
    document.removeEventListener('mouseup', up);
    document.removeEventListener('mousedown', outside);
    window.removeEventListener('blur', up);
  }
  onMounted(attach);
  onActivated(attach);
  onDeactivated(detach);
  onBeforeUnmount(detach);
  return { down, over, keydown, copy, clear, snapshot };
}
