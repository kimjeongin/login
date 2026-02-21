const env = import.meta.env as Record<string, string | undefined>;

const keycloakBaseUrl = env.WXT_PUBLIC_KEYCLOAK_BASE_URL ?? 'http://localhost:8080';
const keycloakRealm = env.WXT_PUBLIC_KEYCLOAK_REALM ?? 'test';

export const API_BASE_URL = env.WXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';
export const KEYCLOAK_CLIENT_ID = env.WXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'extension-client';
export const KEYCLOAK_ISSUER = `${keycloakBaseUrl.replace(/\/$/, '')}/realms/${keycloakRealm}`;
export const KEYCLOAK_AUTH_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/auth`;
export const KEYCLOAK_TOKEN_URL = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;
