export const environment = {
  production: true,
  apiUrl: '/api',
  oidc: {
    authority: '${OIDC_AUTHORITY}',
    clientId: '${OIDC_CLIENT_ID}',
    redirectUri: '${OIDC_REDIRECT_URI}',
    scope: 'openid profile email',
  },
};
