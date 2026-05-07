import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  Household,
  HouseholdMember,
  HouseholdWithRole,
  InvitationLink,
  CreateInviteLinkRequest,
  InviteTokenInfo,
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

  updateNote(hid: string, note: string | null): Promise<Household> {
    return firstValueFrom(this.http.patch<Household>(`${BASE}/${hid}/note`, { note }));
  }

  listMembers(hid: string): Promise<HouseholdMember[]> {
    return firstValueFrom(this.http.get<HouseholdMember[]>(`${BASE}/${hid}/members`));
  }

  removeMember(hid: string, userId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/members/${userId}`));
  }

  changeMemberRole(hid: string, userId: string, role: 'OWNER' | 'MEMBER'): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`${BASE}/${hid}/members/${userId}`, { role }),
    );
  }

  listInvites(hid: string): Promise<InvitationLink[]> {
    return firstValueFrom(this.http.get<InvitationLink[]>(`${BASE}/${hid}/invites`));
  }

  createInvite(hid: string, body: CreateInviteLinkRequest = {}): Promise<InvitationLink> {
    return firstValueFrom(this.http.post<InvitationLink>(`${BASE}/${hid}/invites`, body));
  }

  deleteInvite(hid: string, inviteId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/invites/${inviteId}`));
  }

  sendInviteEmail(hid: string, inviteId: string, email: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${BASE}/${hid}/invites/${inviteId}/send`, { email }),
    );
  }

  getInviteInfo(token: string): Promise<InviteTokenInfo> {
    return firstValueFrom(this.http.get<InviteTokenInfo>(`/api/v1/join/${token}`));
  }

  joinByToken(token: string): Promise<{ householdId: string; id: string }> {
    return firstValueFrom(
      this.http.post<{ householdId: string; id: string }>(`/api/v1/join/${token}`, {}),
    );
  }

  leaveHousehold(hid: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}/leave`));
  }

  deleteHousehold(hid: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${BASE}/${hid}`));
  }
}
