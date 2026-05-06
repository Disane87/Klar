import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { OAuthScope } from '@klar/shared';

export interface ConsentInfo {
  client: {
    clientId: string;
    clientName: string;
    logoUri: string | null;
    clientUri: string | null;
    tosUri: string | null;
    policyUri: string | null;
  };
  scopes: { id: OAuthScope; title: string; desc: string; icon: string; write?: boolean }[];
  redirectUri: string;
  state: string;
  autoApprove: boolean;
}

export interface AuthorizeRequestParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}

const BASE = '/api/v1/oauth/consent';

@Injectable({ providedIn: 'root' })
export class OAuthConsentService {
  private http = inject(HttpClient);

  getInfo(params: AuthorizeRequestParams): Observable<ConsentInfo> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      p = p.set(k, v);
    }
    return this.http.get<ConsentInfo>(BASE, { params: p });
  }

  decide(
    params: AuthorizeRequestParams,
    approve: boolean,
  ): Observable<{ redirectUrl: string }> {
    return this.http.post<{ redirectUrl: string }>(BASE, { ...params, approve });
  }
}
