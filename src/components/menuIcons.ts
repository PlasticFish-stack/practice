import type { Component } from 'vue';
import {
  Connection,
  DataAnalysis,
  Document,
  FolderOpened,
  Key,
  Menu,
  Monitor,
  Setting,
  Tools,
  User,
  UserFilled,
} from '@element-plus/icons-vue';
import type { MENU_ICONS } from '@/auth/navigation';

const icons = {
  Connection,
  DataAnalysis,
  Document,
  FolderOpened,
  Key,
  Menu,
  Monitor,
  Setting,
  Tools,
  User,
  UserFilled,
} satisfies Record<(typeof MENU_ICONS)[number], Component>;

/** 服务端只存图标名称，组件由前端白名单解析，未知值回退为文档图标。 */
export function menuIcon(name: string): Component {
  return Object.hasOwn(icons, name) ? icons[name as keyof typeof icons] : Document;
}
