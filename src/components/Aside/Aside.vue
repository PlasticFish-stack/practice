<script setup lang="ts">
import { computed, ref } from 'vue';

const isCollapse = ref(false)

</script>

<template>
    <el-aside width="auto" style="overflow: visible;">
        <div id="aside-container">
            <div id="aside-btn" @click="isCollapse = !isCollapse">
                <el-icon id="aside-btn-icon" :class="{ 'is-collapse' : isCollapse}">
                    <ArrowLeft />
                </el-icon>
            </div>
            <slot :isCollapse="isCollapse"></slot>
        </div>
    </el-aside>
</template>

<style scoped lang="scss">
#aside-container {
    --aside-btn-size: 30px;
    box-sizing: border-box;
    height: 100%;
    padding: 10px;
    border-right: 1px solid var(--el-border-color);
    position: relative;

    #aside-btn {
        height: var(--aside-btn-size);
        width: var(--aside-btn-size);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 90px;
        border: 1px solid var(--el-border-color);
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