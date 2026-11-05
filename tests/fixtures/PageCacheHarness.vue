<script setup lang="ts">
import { onActivated, onDeactivated, onScopeDispose, shallowRef } from 'vue';

const props = defineProps<{ label: string }>();
const state = window as Window & { cacheTest?: { sequence: number; events: string[] } };
const events = (state.cacheTest ??= { sequence: 0, events: [] });
const instance = ++events.sequence;
const draft = shallowRef('');
events.events.push(`create:${props.label}:${instance}`);
onActivated(() => events.events.push(`activate:${props.label}:${instance}`));
onDeactivated(() => events.events.push(`deactivate:${props.label}:${instance}`));
onScopeDispose(() => events.events.push(`dispose:${props.label}:${instance}`));
</script>

<template>
  <section>
    <h2>{{ label }}</h2>
    <label>
      页签测试草稿
      <input
        v-model="draft"
        aria-label="页签测试草稿"
      />
    </label>
    <output aria-label="实例编号">{{ instance }}</output>
    <div
      v-if="label === 'a'"
      style="height: 1400px"
      aria-hidden="true"
    />
  </section>
</template>
