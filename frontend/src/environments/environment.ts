export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  oidc: {
    authority: 'http://localhost:8080/realms/denaro',
    clientId: 'denaro',
    redirectUri: 'http://localhost:4200/auth/callback',
    scope: 'openid profile email',
  },
};
