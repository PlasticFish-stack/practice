<script setup lang="ts">

</script>

<template> 
    <el-main>
        <div class="main-container">
            <div class="main-breadcrumb">
                <el-breadcrumb separator="/">
                    <el-breadcrumb-item :to="{ path: '/' }">homepage</el-breadcrumb-item>
                    <el-breadcrumb-item>
                        <a href="/">promotion management</a>
                    </el-breadcrumb-item>
                    <el-breadcrumb-item>promotion list</el-breadcrumb-item>
                    <el-breadcrumb-item>promotion detail</el-breadcrumb-item>
                </el-breadcrumb>
            </div>
            <Devices />
        </div>

    </el-main>
</template>

<style scoped lang="scss">
.main-container{
    padding-top: 10px;
    padding-left: 15px;
    padding-right: 15px;
}
.main-breadcrumb {}
</style>