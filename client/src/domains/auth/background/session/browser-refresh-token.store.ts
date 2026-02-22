import type { RefreshTokenStore } from './session.types';

const DEFAULT_REFRESH_TOKEN_STORAGE_KEY = 'auth.refresh-token.v1';

type SessionStorageArea = {
  get: (
    keys?:
      | string
      | string[]
      | Record<string, unknown>
      | null,
  ) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  setAccessLevel?: (options: {
    accessLevel: 'TRUSTED_CONTEXTS' | 'TRUSTED_AND_UNTRUSTED_CONTEXTS';
  }) => Promise<void>;
};

function getStorageSession(): SessionStorageArea {
  return browser.storage.session as unknown as SessionStorageArea;
}

export function createBrowserRefreshTokenStore(
  storageKey = DEFAULT_REFRESH_TOKEN_STORAGE_KEY,
): RefreshTokenStore {
  return {
    read: async () => {
      const result = await getStorageSession().get(storageKey);
      const refreshToken = result[storageKey];
      return typeof refreshToken === 'string' && refreshToken.length > 0
        ? refreshToken
        : null;
    },
    write: async (refreshToken: string) => {
      await getStorageSession().set({
        [storageKey]: refreshToken,
      });
    },
    clear: async () => {
      await getStorageSession().remove(storageKey);
    },
    initializePolicy: async () => {
      await getStorageSession().setAccessLevel?.({
        accessLevel: 'TRUSTED_CONTEXTS',
      });
    },
  };
}
