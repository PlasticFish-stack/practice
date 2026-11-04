<template>
  <svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true">
    <circle v-for="point in [[3, 3], [9, 3], [3, 8], [9, 8], [3, 13], [9, 13]]" :key="point.join()" :cx="point[0]" :cy="point[1]" r="1" fill="currentColor" />
  </svg>
</template>
