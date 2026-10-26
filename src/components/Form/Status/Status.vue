<script setup lang="ts">

</script>

<template>
    <div class="status-container">
        <span class="status" />
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
    width: 8px;
    height: 8px;
    display: inline-block;
    background-color: red;
    color: red;
    border-radius: 90px;
    position: relative;
    isolation: isolate;
    z-index: 1;
    will-change: transform;
}

.status::before {
    content: '';
    height: 8px;
    width: 8px;
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