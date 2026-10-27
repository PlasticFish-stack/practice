<script setup lang="ts">
import { computed } from 'vue';

const { color = 'red', size = 8, sizeType = 'px' } = defineProps<{
    color?: string
    size?: number
    sizeType?: string
    ripple?: boolean
}>()

const sizePx = computed(() => `${size}${sizeType}`)
console.log(color);

</script>

<template>
    <div class="status-container">
        <span class="status" :class="{ 'is-ripple': ripple }" />
    </div>

</template>

<style scoped lang="scss">
.status-container {
    padding: 12px;
    contain: layout paint;
    display: flex;
    justify-content: center;
    align-items: center;
}

.status {
    width: v-bind(sizePx);
    height: v-bind(sizePx);
    display: inline-block;
    background-color: v-bind(color);
    color: v-bind(color);
    border-radius: 90px;
    position: relative;
    isolation: isolate;
    z-index: 1;
    will-change: transform;
}

.status.is-ripple::before {
    content: '';
    height: v-bind(sizePx);
    width: v-bind(sizePx);
    display: inline-block;
    border-radius: 90px;
    border-color: inherit;
    border-width: 4px;
    border-style: solid;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    // opacity: 0;
    animation: ripple 1.2s ease-in-out infinite;
}

@keyframes ripple {
    0% {
        transform: translate(-50%, -50%) scale(0.9);
        // clip-path: circle(0 at 50% 50%);
        opacity: .5;
    }

    100% {
        transform: translate(-50%, -50%) scale(1.4);
        // clip-path: circle(60px at 50% 50%);
        opacity: 0;
    }
}
</style>