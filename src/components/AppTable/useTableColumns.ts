import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { ColumnOptions } from './types'

export type ColumnSettingItem = { id: string; label: string; visible: boolean; locked: boolean; resizable: boolean; visibilityLocked: boolean; width: number; minWidth: number; bucket: string; moveUp: boolean; moveDown: boolean }
type Preferences = { version: 1; order: string[]; hidden: string[]; widths: Record<string, number> }
const empty = (): Preferences => ({ version: 1, order: [], hidden: [], widths: {} })
export const columnIdentity = <Row extends object>(column: ColumnOptions<Row>) => column.key ?? column.prop ?? column.columnKey

/** Owns column preferences only; source visibility and fixed/utility positions always win. */
export function useTableColumns<Row extends object>(source: MaybeRefOrGetter<readonly ColumnOptions<Row>[]>, storageKey: MaybeRefOrGetter<string | undefined>) {
  const preferences = shallowRef<Preferences>(empty())
  const input = computed(() => toValue(source))
  const key = computed(() => { const value = toValue(storageKey); return value ? `app-table:columns:v1:${value}` : undefined })
  const idCounts = computed(() => {
    const counts = new Map<string, number>()
    for (const column of input.value) { const id = columnIdentity(column); if (id) counts.set(id, (counts.get(id) ?? 0) + 1) }
    return counts
  })
  function locked(column: ColumnOptions<Row>) {
    const id = columnIdentity(column)
    return !id || idCounts.value.get(id) !== 1 || !column.label || !!column.settingsLocked || !!column.children?.length || (!!column.type && column.type !== 'default') || !!column.expand || id === 'actions'
  }
  const bucket = (column: ColumnOptions<Row>) => column.fixed === 'right' ? 'right' : column.fixed ? 'left' : 'main'
  const minimum = (column: ColumnOptions<Row>) => Math.max(64, Number.parseFloat(String(column.minWidth)) || 64)
  function width(column: ColumnOptions<Row>, value: number) { return Math.round(Math.max(minimum(column), Math.min(Math.max(1200, minimum(column)), value))) }
  watch(key, value => {
    const next = empty()
    try {
      const saved: unknown = value ? JSON.parse(localStorage.getItem(value) ?? 'null') : null
      if (saved && typeof saved === 'object' && 'version' in saved && saved.version === 1) {
        const state = saved as Partial<Preferences>
        next.order = Array.isArray(state.order) ? [...new Set(state.order.filter((id): id is string => typeof id === 'string'))].slice(0, 500) : []
        next.hidden = Array.isArray(state.hidden) ? [...new Set(state.hidden.filter((id): id is string => typeof id === 'string'))].slice(0, 500) : []
        if (state.widths && typeof state.widths === 'object') next.widths = Object.fromEntries(Object.entries(state.widths).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)).slice(0, 500))
      }
    } catch { /* Invalid or unavailable browser storage uses defaults. */ }
    preferences.value = next
  }, { immediate: true, flush: 'sync' })
  function commit(next: Preferences) {
    preferences.value = next
    try { if (key.value) localStorage.setItem(key.value, JSON.stringify(next)) } catch { /* Still works for the current mount. */ }
  }
  const ordered = computed(() => {
    const order = new Map(preferences.value.order.map((id, index) => [id, index]))
    const buckets = new Map<string, ColumnOptions<Row>[]>()
    for (const column of input.value) {
      if (column.hidden || locked(column)) continue
      const group = buckets.get(bucket(column)) ?? []; group.push(column); buckets.set(bucket(column), group)
    }
    for (const group of buckets.values()) group.sort((a, b) => (order.get(columnIdentity(a)!) ?? Infinity) - (order.get(columnIdentity(b)!) ?? Infinity))
    const offsets = new Map<string, number>()
    return input.value.map(column => {
      if (column.hidden || locked(column)) return column
      const group = bucket(column), index = offsets.get(group) ?? 0
      offsets.set(group, index + 1)
      return buckets.get(group)![index]!
    })
  })
  const hidden = computed(() => new Set(preferences.value.hidden))
  // A saved configuration may not hide the last remaining data column after permissions change.
  const ensureVisible = computed(() => {
    const candidates = ordered.value.filter(column => !column.hidden && !locked(column))
    return candidates.length && candidates.every(column => hidden.value.has(columnIdentity(column)!)) ? columnIdentity(candidates[0]!) : undefined
  })
  const columns = computed(() => ordered.value.map(column => {
    if (column.hidden || locked(column)) return column
    const id = columnIdentity(column)!, savedWidth = Object.hasOwn(preferences.value.widths, id) ? preferences.value.widths[id] : undefined
    return { ...column, hidden: hidden.value.has(id) && ensureVisible.value !== id, ...(savedWidth !== undefined ? { width: width(column, savedWidth) } : {}) }
  }))
  const items = computed<ColumnSettingItem[]>(() => {
    const visibleCount = columns.value.filter(column => !column.hidden && !locked(column)).length
    return columns.value.filter(column => !!column.label && !input.value.find(item => item === column || columnIdentity(item) === columnIdentity(column))?.hidden).map((column, index) => {
      const id = columnIdentity(column) ?? `locked-${index}`, group = bucket(column), isLocked = locked(column)
      const peers = columns.value.filter(item => !locked(item) && !input.value.find(original => columnIdentity(original) === columnIdentity(item))?.hidden && bucket(item) === group)
      const position = peers.findIndex(item => columnIdentity(item) === id)
      return { id, label: column.label!, visible: !column.hidden, locked: isLocked, resizable: !isLocked && column.resizable !== false, visibilityLocked: isLocked || (!column.hidden && visibleCount <= 1), width: Number.parseFloat(String(column.width ?? column.minWidth)) || 160, minWidth: minimum(column), bucket: group, moveUp: !isLocked && position > 0, moveDown: !isLocked && position < peers.length - 1 }
    })
  })
  function setVisible(id: string, visible: boolean) {
    const item = items.value.find(item => item.id === id)
    if (!item || item.locked || (!visible && item.visibilityLocked)) return
    const next = new Set(preferences.value.hidden)
    if (visible) next.delete(id); else next.add(id)
    commit({ ...preferences.value, hidden: [...next] })
  }
  function moveTo(id: string, target: string) {
    const a = items.value.find(item => item.id === id), b = items.value.find(item => item.id === target)
    if (!a || !b || a.locked || b.locked || a.bucket !== b.bucket || id === target) return
    const order = ordered.value.filter(column => !column.hidden && !locked(column)).map(column => columnIdentity(column)!)
    const from = order.indexOf(id), to = order.indexOf(target)
    if (from < 0 || to < 0) return
    order.splice(from, 1); order.splice(to, 0, id)
    commit({ ...preferences.value, order })
  }
  function move(id: string, direction: -1 | 1) {
    const item = items.value.find(item => item.id === id)
    if (!item) return
    const peers = items.value.filter(peer => !peer.locked && peer.bucket === item.bucket)
    const target = peers[peers.findIndex(peer => peer.id === id) + direction]
    if (target) moveTo(id, target.id)
  }
  function resize(id: string, value: number) {
    const column = input.value.find(column => columnIdentity(column) === id)
    if (!column || locked(column) || column.resizable === false || !Number.isFinite(value)) return
    commit({ ...preferences.value, widths: { ...preferences.value.widths, [id]: width(column, value) } })
  }
  function reset() {
    preferences.value = empty()
    try { if (key.value) localStorage.removeItem(key.value) } catch { /* Reset current state even without storage. */ }
  }
  return { columns, items, setVisible, move, moveTo, resize, reset }
}
