import type { SessionUser } from './permissions.ts';

export const profileFields = [
  'displayName',
  'email',
  'phone',
  'title',
  'department',
  'bio',
  'avatarUrl',
] as const;
export type UserProfile = Record<(typeof profileFields)[number], string>;

export function profileFromUser(user: SessionUser | null): UserProfile {
  return Object.fromEntries(profileFields.map((key) => [key, user?.[key] ?? ''])) as UserProfile;
}

export function validAvatarUrl(value: string) {
  if (!value) return true;
  // eslint-disable-next-line no-control-regex -- Intentionally reject control characters in local avatar paths.
  if (/^\/(?!\/)/.test(value)) return !/[\\\u0000-\u0020]/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateProfile(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '个人资料格式错误';
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some((key) => !profileFields.includes(key as (typeof profileFields)[number]))
  )
    return '包含不可修改的字段';
  if (profileFields.some((key) => typeof data[key] !== 'string')) return '请完整填写个人资料';
  const profile = data as UserProfile;
  if (!profile.displayName.trim() || profile.displayName.length > 40) return '昵称应为 1–40 个字符';
  if (
    profile.email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) || profile.email.length > 254)
  )
    return '请输入有效的邮箱地址';
  if (profile.phone.length > 32 || (profile.phone && !/^[+\d()\-\s]+$/.test(profile.phone)))
    return '请输入有效的联系电话';
  if (profile.title.length > 80 || profile.department.length > 80)
    return '职位和部门最多 80 个字符';
  if (profile.bio.length > 300) return '个人简介最多 300 个字符';
  if (profile.avatarUrl.length > 2048 || !validAvatarUrl(profile.avatarUrl))
    return '头像地址需为 HTTPS 或本站路径';
  return null;
}
