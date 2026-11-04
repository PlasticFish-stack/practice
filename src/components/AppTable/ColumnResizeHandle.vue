<script setup lang="ts">
import { shallowRef } from 'vue'
const props = defineProps<{ width: number; minWidth: number; label: string }>()
const emit = defineEmits<{ resize: [width: number] }>()
const delta = shallowRef(0), dragging = shallowRef(false)
let startX = 0, startWidth = 0
function down(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault(); event.stopPropagation()
  startX = event.clientX; startWidth = props.width; delta.value = 0; dragging.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function move(event: PointerEvent) {
  if (dragging.value) delta.value = Math.max(props.minWidth, Math.min(1200, startWidth + event.clientX - startX)) - startWidth
}
function up() {
  if (!dragging.value) return
  dragging.value = false; emit('resize', startWidth + delta.value); delta.value = 0
}
function keydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault(); event.stopPropagation()
  emit('resize', Math.max(props.minWidth, Math.min(1200, props.width + (event.key === 'ArrowRight' ? 10 : -10))))
}
</script>
<template>
  <button type="button" class="column-resize-handle" :class="{ 'is-resizing': dragging }" :style="dragging ? { transform: `translateX(${delta}px)` } : undefined"
    :aria-label="`调整列宽：${label}`" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="dragging = false; delta = 0" @lostpointercapture="dragging = false; delta = 0"
    @keydown="keydown" @click.stop @dblclick.stop />
</template>
<style scoped>
.column-resize-handle { position: absolute; inset-inline-end: 0; top: 8px; bottom: 8px; width: 8px; border: 0; border-right: 1px solid var(--el-border-color-lighter); background: transparent; cursor: col-resize; touch-action: none; z-index: 2; }
.column-resize-handle:hover, .column-resize-handle:focus-visible, .column-resize-handle.is-resizing { border-right: 2px solid var(--el-color-primary); outline: none; }
</style>
