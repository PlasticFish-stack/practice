import type { Router, RouteRecordRaw } from 'vue-router';
import type { PermissionRequirement } from '@/auth/permissions';
import type { MenuSetting } from '@/types/system';

export interface MenuNode {
  index: string;
  title: string;
  icon: string;
  path: string;
  order: number;
  children: MenuNode[];
}

/** 按原始路由层级生成菜单；隐藏布局可透传子项，无权限父级不会透传。 */
export function buildMenuTree(
  router: Router,
  can: (required: PermissionRequirement, record: RouteRecordRaw) => boolean,
  settings: readonly MenuSetting[] = [],
): MenuNode[] {
  function visit(records: readonly RouteRecordRaw[]): MenuNode[] {
    return records
      .flatMap((record) => {
        const setting = settings.find((item) => item.routeName === record.name);
        if (setting && (!setting.visible || !can(setting.permissions, record))) return [];
        if (!can(record.meta?.permissions ?? [], record)) return [];
        const children = visit(record.children ?? []);
        if (!record.meta?.menu) return children;
        if (typeof record.name !== 'string' || !record.meta.title) return [];
        // 分组过滤后没有可访问页面时隐藏；带隐藏详情路由的独立页面仍可显示。
        if (!children.length && (!record.component || record.redirect)) return [];
        return [
          {
            index: record.name,
            title: setting?.title ?? record.meta.title,
            icon: setting?.icon ?? record.meta.icon ?? 'Document',
            path: router.resolve({ name: record.name }).path,
            order: setting?.order ?? record.meta.menuOrder ?? 0,
            children,
          },
        ];
      })
      .sort((a, b) => a.order - b.order);
  }
  return visit(router.options.routes);
}

export function firstMenuPath(
  nodes: readonly MenuNode[],
  accept: (node: MenuNode) => boolean = () => true,
): string | undefined {
  for (const node of nodes) {
    const path = node.children.length
      ? firstMenuPath(node.children, accept)
      : accept(node)
        ? node.path
        : undefined;
    if (path) return path;
  }
}

export function menuTrail(nodes: readonly MenuNode[], index: string): string[] {
  for (const node of nodes) {
    if (node.index === index) return [node.index];
    const trail = menuTrail(node.children, index);
    if (trail.length) return [node.index, ...trail];
  }
  return [];
}
