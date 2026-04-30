import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Household,
  HouseholdMember,
  HouseholdWithRole,
  InviteCode,
  CreateInviteRequest,
} from '@klar/shared';

const BASE = '/api/v1/households';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private http = inject(HttpClient);

  listMyHouseholds(): Promise<HouseholdWithRole[]> {
    return firstValueFrom(this.http.get<HouseholdWithRole[]>(BASE));
  }

  getHousehold(hid: string): Promise<Household> {
    return firstValueFrom(this.http.get<Household>(`${BASE}/${hid}`));
  }

  renameHousehold(hid: string, name: string): Promise<Household> {
    return firstValueFrom(this.http.patch<Household>(`${BASE}/${hid}`, { name }));
  }

  listMembers(hid: string): Promise<HouseholdMember[]> {
    return firstValueFrom(this.http.get<HouseholdMember[]>(`${BASE}/${hid}/members`));
  }

  removeMember(hid: string, userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/members/${userId}`));
  }

  listInvites(hid: string): Promise<InviteCode[]> {
    return firstValueFrom(this.http.get<InviteCode[]>(`${BASE}/${hid}/invites`));
  }

  createInvite(hid: string, body: CreateInviteRequest = {}): Promise<InviteCode> {
    return firstValueFrom(this.http.post<InviteCode>(`${BASE}/${hid}/invites`, body));
  }

  deleteInvite(hid: string, inviteId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/invites/${inviteId}`));
  }

  joinByCode(code: string): Promise<{ householdId: string }> {
    return firstValueFrom(
      this.http.post<{ householdId: string }>(`${BASE}/join`, { code }),
    );
  }
}
