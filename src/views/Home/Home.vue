<script setup lang="ts">
import Devices from '@/components/Devices/Devices.vue';
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

        <el-aside width="260px">
          <div id="aside-container">
            <Menu></Menu>
          </div>
        </el-aside>

        <el-main>
          <Devices />
        </el-main>
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
#aside-container{
  box-sizing: border-box;
  height: 100%;
  padding: 10px;
  border-right: 1px solid var(--el-border-color);
}
</style>