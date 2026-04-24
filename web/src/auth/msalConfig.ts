/**
 * Configuracion de MSAL para Microsoft Entra ID.
 * En desarrollo el DEV_BYPASS del backend permite trabajar sin Azure AD;
 * este modulo queda como scaffold para Fase 9 (deploy) cuando haya un
 * App Registration real.
 */

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? '';
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? '';
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI ?? window.location.origin;

/**
 * `true` cuando la app tiene credenciales de Entra ID configuradas.
 * Si es `false` (entorno dev sin env vars), el frontend asume que el backend
 * maneja la auth via DEV_BYPASS y no intenta loguear con MSAL.
 */
export const isMsalConfigured: boolean = Boolean(tenantId && clientId);

export const msalConfig = {
  auth: {
    clientId,
    authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : '',
    redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage' as const,
    storeAuthStateInCookie: false,
  },
};

/** Scopes solicitados al obtener el access token. */
export const loginRequest = {
  scopes: tenantId ? [`api://${clientId}/.default`] : ['openid', 'profile'],
};
