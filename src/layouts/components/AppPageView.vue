<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import type { PageTab } from '@/stores/pageTabs';

const props = defineProps<{
  items: readonly PageTab[];
  activeKey: string;
  allowed: boolean;
  owner: string;
}>();
const route = useRoute();
const activeTab = computed(() => props.items.find((tab) => tab.key === props.activeKey));
</script>

<template>
  <RouterView v-slot="{ Component }">
    <div
      :key="owner"
      class="page-views"
    >
      <section
        v-for="tab in items"
        :id="`workspace-panel-${tab.id}`"
        :key="tab.id"
        v-show="allowed && tab.key === activeKey"
        role="tabpanel"
        :aria-labelledby="`workspace-tab-${tab.id}`"
      >
        <!-- 每个页签独立持有一个缓存；移除页签会卸载整个 KeepAlive，真正释放实例。 -->
        <KeepAlive
          v-if="tab.keepAlive"
          :max="1"
        >
          <component
            :is="Component"
            v-if="allowed && tab.key === activeKey"
            :key="tab.id"
          />
        </KeepAlive>
        <component
          :is="Component"
          v-else-if="allowed && tab.key === activeKey"
          :key="tab.id"
        />
      </section>
      <component
        :is="Component"
        v-if="allowed && !activeTab"
        :key="route.fullPath"
      />
    </div>
  </RouterView>
</template>
