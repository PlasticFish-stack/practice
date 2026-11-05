import type { Permission } from '../auth/permissions.ts';

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  permissions: Permission[];
  version: number;
  protected: boolean;
}
export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roleIds: string[];
  enabled: boolean;
  version: number;
}
export interface MenuSetting {
  routeName: string;
  parent?: string;
  path: string;
  title: string;
  icon: string;
  order: number;
  visible: boolean;
  permissions: Permission[];
  version: number;
  protected: boolean;
}
export type UserDraft = Pick<
  UserRecord,
  'username' | 'displayName' | 'email' | 'roleIds' | 'enabled'
> & { password: string; version?: number };
export type RoleDraft = Pick<
  RoleRecord,
  'code' | 'name' | 'description' | 'enabled' | 'permissions'
> & { version?: number };
export type MenuDraft = Pick<
  MenuSetting,
  'title' | 'icon' | 'order' | 'visible' | 'permissions' | 'version'
>;
export interface SystemCatalog {
  roles: RoleRecord[];
  permissions: {
    code: Permission;
    label: string;
    group: string;
    requires?: readonly Permission[];
  }[];
  icons: string[];
}
export interface SystemQuery {
  keyword: string;
  page: number;
  pageSize: number;
}
