<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { CircleCheck, Message, OfficeBuilding, Postcard } from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import ProfileEditor from './components/ProfileEditor.vue';
import { PERMISSION_CATALOG } from '@/auth/permissions';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const editing = shallowRef(route.query.edit === '1');
// 非活动页仍会看到全局 route；只响应自己的 URL，保留缓存中的资料草稿。
watch(
  () => route.fullPath,
  () => {
    if (route.name === 'account-center') editing.value = route.query.edit === '1';
  },
);
const notice = shallowRef('');
function edit() {
  notice.value = '';
  void router.push({
    name: 'account-center',
    query: { ...route.query, edit: '1' },
    hash: route.hash,
  });
}
function finish(saved = false) {
  if (route.name !== 'account-center' || !editing.value) return;
  notice.value = saved ? '个人资料已更新' : '';
  const { edit: _edit, ...query } = route.query;
  void router.replace({ name: 'account-center', query, hash: route.hash });
}
const permissionLabels: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.map((item) => [item.code, item.label]),
);
const details = computed(() => [
  ['用户名', auth.user?.username],
  ['邮箱', auth.user?.email],
  ['联系电话', auth.user?.phone],
  ['部门', auth.user?.department],
  ['职位', auth.user?.title],
  ['用户 ID', auth.user?.id],
]);
</script>

<template>
  <div
    class="account-center"
    :class="{ 'is-editing': editing }"
  >
    <section class="profile-card">
      <UserAvatar
        :user="auth.user"
        :size="88"
      />
      <h2>{{ auth.user?.displayName }}</h2>
      <p class="profile-bio">{{ auth.user?.bio || '还没有填写个人简介' }}</p>
      <div class="profile-meta">
        <el-icon><Postcard /></el-icon>
        {{ auth.user?.title || '未填写职位' }}
      </div>
      <div class="profile-meta">
        <el-icon><OfficeBuilding /></el-icon>
        {{ auth.user?.department || '未填写部门' }}
      </div>
      <div class="profile-meta">
        <el-icon><Message /></el-icon>
        {{ auth.user?.email || '未填写邮箱' }}
      </div>
      <div class="profile-divider" />
      <h3>角色</h3>
      <div class="role-list">
        <el-tag
          v-for="role in auth.user?.roles"
          :key="role"
          effect="plain"
        >
          {{ role }}
        </el-tag>
      </div>
      <el-button
        v-if="!editing"
        type="primary"
        plain
        @click="edit"
      >
        编辑个人资料
      </el-button>
    </section>
    <div class="account-sections">
      <el-alert
        v-if="notice && !editing"
        :title="notice"
        type="success"
        :closable="false"
        role="status"
      />
      <ProfileEditor
        v-if="editing"
        class="account-card"
        @saved="finish(true)"
        @cancel="finish()"
      />
      <section
        v-else
        class="account-card"
      >
        <div class="card-heading">
          <h3>账户信息</h3>
          <span>当前登录账户</span>
        </div>
        <dl class="account-details">
          <div
            v-for="[label, value] in details"
            :key="label"
          >
            <dt>{{ label }}</dt>
            <dd>{{ value || '未填写' }}</dd>
          </div>
        </dl>
      </section>
      <section class="account-card">
        <div class="card-heading">
          <h3>访问权限</h3>
          <el-tag
            type="info"
            effect="plain"
          >
            {{ auth.user?.permissions.length ?? 0 }} 项权限
          </el-tag>
        </div>
        <div
          v-if="auth.user?.permissions.length"
          class="permission-grid"
        >
          <div
            v-for="permission in auth.user.permissions"
            :key="permission"
            class="permission-item"
          >
            <el-icon><CircleCheck /></el-icon>
            <div>
              <strong>{{ permissionLabels[permission] || permission }}</strong>
              <code>{{ permission }}</code>
            </div>
          </div>
        </div>
        <el-empty
          v-else
          description="当前账户尚未分配业务权限"
          :image-size="64"
        />
        <p class="permission-note">如需调整角色或访问权限，请联系管理员。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.account-center {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: var(--app-space-lg);
  align-items: start;
}
.profile-card,
.account-card {
  padding: var(--app-card-padding);
  background: var(--el-bg-color);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  box-shadow: var(--app-shadow-card);
}
.profile-card {
  text-align: center;
}
.profile-card h2 {
  margin: 16px 0 8px;
  font-size: 22px;
}
.profile-bio {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.profile-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  margin-top: 16px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  overflow-wrap: anywhere;
}
.profile-divider {
  border-top: 1px dashed var(--el-border-color);
  margin: 24px 0 20px;
}
.profile-card h3 {
  text-align: left;
  margin: 0 0 12px;
  font-size: 14px;
}
.role-list {
  display: flex;
  gap: var(--app-space-xs);
  flex-wrap: wrap;
  margin-bottom: var(--app-space-lg);
}
.account-sections {
  display: grid;
  gap: var(--app-space-lg);
}
.card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--app-space-sm);
  border-bottom: var(--app-border-secondary);
  padding-bottom: var(--app-space-md);
  margin-bottom: var(--app-space-md);
}
.card-heading h3 {
  margin: 0;
  font-size: 16px;
}
.card-heading > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.account-details {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-lg);
}
.account-details dt {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.account-details dd {
  margin: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.permission-grid {
  display: grid;
  gap: var(--app-space-sm);
}
.permission-item {
  display: flex;
  align-items: center;
  gap: var(--app-space-sm);
  padding: var(--app-space-sm) var(--app-space-md);
  background: var(--el-fill-color-light);
  border-radius: var(--app-radius-base);
}
.permission-item > .el-icon {
  font-size: 20px;
  color: var(--el-color-success);
}
.permission-item strong {
  display: block;
  font-size: 14px;
  font-weight: 500;
}
.permission-item code {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.permission-note {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 0;
}
@media (max-width: 1000px) {
  .account-center {
    grid-template-columns: 1fr;
  }
  .account-center.is-editing .profile-card {
    display: none;
  }
}
@media (max-width: 600px) {
  .account-details {
    grid-template-columns: 1fr;
  }
}
</style>
