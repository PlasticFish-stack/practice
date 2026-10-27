<script setup lang="ts">
import Aside from '@/components/Aside/Aside.vue';
import Devices from '@/components/Devices/Devices.vue';
import Main from '@/components/Main/Main.vue';
import Menu from '@/components/Menu/Menu.vue';

</script>

<template>
  <el-container>
    <el-header>
      <div id="header-container">
        <div>
          <div>
            <el-icon>
              <Message />
            </el-icon>
          </div>
          <div></div>
          <div></div>
        </div>
      </div>
    </el-header>
    <el-container>
      <Aside #default="{ isCollapse }">
        <Menu :is-collapse="isCollapse"></Menu>
      </Aside>
      <Main></Main>
    </el-container>
  </el-container>

</template>

<style scoped lang="scss">
#header-container {
  display: flex;
  height: 100%;
  width: 100%;
  position: relative;
  border-bottom: 1px solid var(--el-border-color);
  z-index: 1;
}
</style>