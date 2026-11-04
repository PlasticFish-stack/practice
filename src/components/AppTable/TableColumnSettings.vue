<script setup lang="ts">
import { shallowRef } from 'vue'
import { Setting, ArrowUp, ArrowDown, Lock } from '@element-plus/icons-vue'
import { ElButton, ElCheckbox, ElIcon, ElInputNumber, ElPopover } from 'element-plus'
import type { ColumnSettingItem } from './useTableColumns'
import DragHandleIcon from './DragHandleIcon.vue'
defineProps<{ items: ColumnSettingItem[]; disabled?: boolean }>()
const emit = defineEmits<{ visibility: [id: string, visible: boolean]; move: [id: string, direction: -1 | 1]; reorder: [id: string, target: string]; resize: [id: string, width: number]; reset: [] }>()
const dragged = shallowRef(''), target = shallowRef('')
function start(event: DragEvent, id: string) {
  dragged.value = id
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }
}
function end() { dragged.value = target.value = '' }
</script>
<template>
  <ElPopover trigger="click" placement="bottom-end" :width="360" :disabled="disabled" :popper-options="{ modifiers: [{ name: 'preventOverflow', options: { altAxis: true, padding: 12 } }] }" popper-class="table-column-settings-popper">
    <template #reference><ElButton :disabled="disabled" :icon="Setting" aria-label="列设置">列设置</ElButton></template>
    <section class="column-settings" aria-label="表格列设置">
      <header class="settings-heading"><strong>列设置</strong><ElButton link type="primary" @click="emit('reset')">恢复默认</ElButton></header>
      <p class="settings-hint">勾选显示列，拖动手柄调整顺序</p>
      <ul class="settings-list">
        <li v-for="item in items" :key="item.id" :data-column-id="item.id" class="settings-item" :class="{ 'is-drop-target': target === item.id }"
          @dragover="event => { if (dragged && !item.locked && items.find(source => source.id === dragged)?.bucket === item.bucket) { event.preventDefault(); target = item.id } }"
          @drop.prevent="emit('reorder', dragged, item.id); end()">
          <div class="settings-row">
            <button v-if="!item.locked" type="button" class="order-handle" draggable="true" :aria-label="`拖动排序：${item.label}`" @dragstart="start($event, item.id)" @dragend="end"><DragHandleIcon /></button>
            <ElIcon v-else class="locked-icon"><Lock /></ElIcon>
            <ElCheckbox :model-value="item.visible" :disabled="item.visibilityLocked" @update:model-value="emit('visibility', item.id, !!$event)">{{ item.label }}</ElCheckbox>
            <span class="settings-position">{{ item.locked ? '保留' : item.bucket === 'left' ? '左固定' : item.bucket === 'right' ? '右固定' : '' }}</span>
            <ElButton text :icon="ArrowUp" :disabled="!item.moveUp" :aria-label="`上移：${item.label}`" @click="emit('move', item.id, -1)" />
            <ElButton text :icon="ArrowDown" :disabled="!item.moveDown" :aria-label="`下移：${item.label}`" @click="emit('move', item.id, 1)" />
          </div>
          <div v-if="!item.locked" class="settings-width"><span>列宽</span><ElInputNumber :model-value="item.width" :disabled="!item.resizable" :min="item.minWidth" :max="Math.max(1200, item.minWidth)" :step="10" :precision="0" size="small" :aria-label="`列宽：${item.label}`" @change="value => { if (value !== undefined) emit('resize', item.id, value) }" /><span>px</span></div>
        </li>
      </ul>
    </section>
  </ElPopover>
</template>
<style scoped>
.settings-heading, .settings-row, .settings-width { display: flex; align-items: center; gap: 8px; }
.settings-heading { justify-content: space-between; padding-top: 8px; }
.settings-hint { color: var(--el-text-color-secondary); font-size: 12px; margin: 8px 0 12px; }
.settings-list { list-style: none; margin: 0; padding: 0; max-height: min(440px, 60vh); overflow-y: auto; }
.settings-item { padding: 8px 4px; border-top: 1px solid var(--el-border-color-lighter); }
.settings-item.is-drop-target { background: var(--el-color-primary-light-9); }
.order-handle { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 0; background: transparent; padding: 0; color: var(--el-text-color-secondary); cursor: grab; }
.order-handle:hover { color: var(--el-color-primary); background: var(--el-fill-color-light); border-radius: 4px; }
.order-handle:active { cursor: grabbing; }
.locked-icon { width: 22px; color: var(--el-text-color-placeholder); }
.settings-row :deep(.el-checkbox) { flex: 1; min-width: 0; margin: 0; }
.settings-row :deep(.el-checkbox__label) { overflow: hidden; text-overflow: ellipsis; }
.settings-row :deep(.el-button) { margin: 0; padding: 4px; height: 24px; }
.settings-position { font-size: 11px; color: var(--el-text-color-secondary); white-space: nowrap; }
.settings-width { margin: 4px 0 0 30px; color: var(--el-text-color-secondary); font-size: 12px; }
.settings-width :deep(.el-input-number) { width: 124px; }
</style>
<style>
.table-column-settings-popper { max-width: calc(100vw - 24px); box-sizing: border-box; }
</style>
