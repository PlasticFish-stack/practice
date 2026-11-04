<script setup lang="ts">

const isCollapse = defineModel<boolean>('collapsed', { default: false })

</script>

<template>
    <el-aside class="app-sidebar" width="auto">
        <div id="aside-container">
            <button id="aside-btn" type="button" :aria-expanded="!isCollapse"
                :aria-label="isCollapse ? '展开侧栏' : '收起侧栏'" @click="isCollapse = !isCollapse">
                <el-icon id="aside-btn-icon" :class="{ 'is-collapse' : isCollapse}">
                    <ArrowLeft />
                </el-icon>
            </button>
            <slot :isCollapse="isCollapse"></slot>
        </div>
    </el-aside>
</template>

<style scoped lang="scss">
.app-sidebar {
    position: sticky;
    top: 56px;
    height: calc(100dvh - 56px);
    flex-shrink: 0;
    overflow: visible;
    background: var(--el-bg-color);
}

#aside-container {
    --aside-btn-size: 30px;
    box-sizing: border-box;
    height: 100%;
    padding: var(--app-menu-sidebar-padding);
    border-right: var(--app-border-secondary);
    position: relative;

    #aside-btn {
        height: var(--aside-btn-size);
        width: var(--aside-btn-size);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--app-radius-round);
        border: var(--app-border);
        background-color: var(--el-bg-color-overlay);
        box-sizing: border-box;
        position: absolute;
        cursor: pointer;
        top: calc(var(--aside-btn-size) / 1.2);
        right: calc(var(--aside-btn-size) / -2);
        z-index: 1;
    }

    #aside-btn-icon {
        opacity: 0.5;
        transition:  opacity 0.2s;
    }

    #aside-btn-icon.is-collapse {
        transform: rotate(180deg);
    }

    #aside-btn:hover #aside-btn-icon {
        opacity: 1;
    }
}
</style>
