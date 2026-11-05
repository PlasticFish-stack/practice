import { api } from './index';
import type { UserProfile } from '@/auth/profile';
import type { SessionUser } from '@/auth/permissions';

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authApi = {
  async session(signal?: AbortSignal) {
    return (await api.get<SessionUser>('/api/auth/session', undefined, { signal })).data;
  },
  async login(credentials: LoginCredentials) {
    await api.get<null>('/api/auth/csrf');
    return (await api.post<SessionUser>('/api/auth/login', credentials)).data;
  },
  async updateProfile(profile: UserProfile) {
    return (
      await api.request<SessionUser>({ url: '/api/auth/profile', method: 'PATCH', data: profile })
    ).data;
  },
  async logout() {
    await api.get<null>('/api/auth/csrf');
    await api.post<null>('/api/auth/logout');
  },
};
