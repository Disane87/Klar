# Header Redesign + Avatar Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the desktop top-bar for visual coherence and add user avatar upload (base64 in DB, shown everywhere initials appear).

**Architecture:** Backend adds `avatarUrl String?` to the `User` model, served via a `POST /api/v1/users/me/avatar` endpoint that uses `sharp` to resize uploads to 128×128 JPEG and stores the base64 data URL. Frontend replaces the two separate HH+User avatar buttons with a single 32px flat-initials circle that opens a combined dropdown including a "Foto ändern" file-input trigger. The top-bar gets month shown as a subtitle under the page title instead of a separate chip on the right.

**Tech Stack:** NestJS 11 + Fastify, `@fastify/multipart`, `sharp`, Prisma, Angular 21 Signals, Spartan UI BrnPopover

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `avatarUrl String?` to `User` |
| `packages/shared/src/types.ts` | Modify | Add `avatarUrl?: string \| null` to `AuthUser` |
| `apps/api/package.json` | Modify | Add `@fastify/multipart`, `sharp`, `@types/sharp` |
| `apps/api/src/main.ts` | Modify | Register `@fastify/multipart` |
| `apps/api/src/users/users.repository.ts` | Modify | Add `setAvatar(id, url)` method |
| `apps/api/src/users/users.service.ts` | Modify | Add `uploadAvatar()`, `deleteAvatar()`, update `toAuthUser()` |
| `apps/api/src/users/users.controller.ts` | Modify | Add `POST /me/avatar` and `DELETE /me/avatar` endpoints |
| `apps/api/src/app.module.ts` | Modify | Add `req.body.avatarUrl` to pino redaction list |
| `apps/web/src/app/core/auth/auth.service.ts` | Modify | Add `uploadAvatar()`, `deleteAvatar()` HTTP methods |
| `apps/web/src/app/core/auth/auth.store.ts` | Modify | Add `updateAvatar(url)` method |
| `apps/web/src/app/shared/ui/klar-header-user.component.ts` | Modify | Full redesign: single avatar + combined dropdown + upload |
| `apps/web/src/app/layout/top-bar/top-bar.component.html` | Modify | Month as subtitle under title, remove `<klar-month-chip>` from right |

---

## Task 1: Prisma schema — add avatarUrl

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field to User model**

In `prisma/schema.prisma`, add after `totpEnabled` (line ~69):

```prisma
  avatarUrl     String?             // base64 data URL, max ~15 KB after resize
```

Full User model after change:
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  displayName   String
  passwordHash  String?
  appRole       AppRole   @default(USER)
  isDeleted     Boolean   @default(false)
  createdAt     DateTime  @default(now())
  lastLoginAt   DateTime?
  totpSecret    String?
  totpEnabled   Boolean   @default(false)
  avatarUrl     String?

  memberships           HouseholdMembership[]
  oidcIdentities        OidcIdentity[]
  refreshTokens         RefreshToken[]
  emailVerifications    EmailVerification[]
  recurringTransactions RecurringTransaction[]
  tempTokens            TempToken[]

  @@index([email])
  @@index([isDeleted])
}
```

- [ ] **Step 2: Create and apply migration**

```bash
cd c:/Workspace/Klar
pnpm --filter api prisma:migrate
```

When prompted for migration name, enter: `add_user_avatar_url`

Expected output: `The following migration(s) have been applied: ...add_user_avatar_url`

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm --filter api exec prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add avatarUrl field to User model"
```

---

## Task 2: Shared types — add avatarUrl to AuthUser

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Update AuthUser type**

In `packages/shared/src/types.ts`, replace the `AuthUser` type:

```ts
/** Öffentliche User-Darstellung (ohne passwordHash) */
export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  appRole: AppRole;
  avatarUrl?: string | null;
  createdAt: string;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Workspace/Klar
pnpm --filter @klar/shared build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add avatarUrl to AuthUser shared type"
```

---

## Task 3: Install backend dependencies

**Files:**
- Modify: `apps/api/package.json` (via pnpm)

- [ ] **Step 1: Install sharp and @fastify/multipart**

```bash
cd c:/Workspace/Klar
pnpm --filter api add @fastify/multipart sharp
pnpm --filter api add -D @types/sharp
```

Expected: both packages appear in `apps/api/package.json` dependencies.

- [ ] **Step 2: Register @fastify/multipart in main.ts**

In `apps/web/../apps/api/src/main.ts`, add the multipart import and registration after the cookie registration:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { RequestMethod } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyCookie = require('@fastify/cookie') as Parameters<NestFastifyApplication['register']>[0];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fastifyMultipart = require('@fastify/multipart') as Parameters<NestFastifyApplication['register']>[0];
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:4200',
    credentials: true,
  });

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/main.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: install sharp and @fastify/multipart for avatar upload"
```

---

## Task 4: Backend avatar endpoints

**Files:**
- Modify: `apps/api/src/users/users.repository.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add setAvatar to UsersRepository**

In `apps/api/src/users/users.repository.ts`, add after the `update()` method:

```ts
async setAvatar(id: string, avatarUrl: string | null): Promise<void> {
  await this.prisma.user.update({ where: { id }, data: { avatarUrl } });
}
```

- [ ] **Step 2: Add uploadAvatar and deleteAvatar to UsersService**

In `apps/api/src/users/users.service.ts`:

Add `sharp` import at the top:
```ts
import sharp from 'sharp';
```

Add `BadRequestException` to NestJS imports:
```ts
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
```

Add the two methods after `deleteAccount()`:

```ts
async uploadAvatar(userId: string, buffer: Buffer, mimetype: string): Promise<{ avatarUrl: string }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(mimetype)) {
    throw new BadRequestException('Nur JPEG, PNG, WebP oder GIF erlaubt');
  }

  const resized = await sharp(buffer)
    .resize(128, 128, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const avatarUrl = `data:image/jpeg;base64,${resized.toString('base64')}`;
  await this.repo.setAvatar(userId, avatarUrl);
  return { avatarUrl };
}

async deleteAvatar(userId: string): Promise<void> {
  await this.repo.setAvatar(userId, null);
}
```

Update `toAuthUser()` to include `avatarUrl`:

```ts
toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    appRole: user.appRole,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
```

- [ ] **Step 3: Add endpoints to UsersController**

In `apps/api/src/users/users.controller.ts`, add these imports:

```ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
```

Add the two new endpoints after `deleteAccount()`:

```ts
@Post('me/avatar')
async uploadAvatar(
  @CurrentUser() payload: JwtPayload,
  @Req() req: FastifyRequest,
): Promise<{ avatarUrl: string }> {
  const data = await req.file();
  if (!data) throw new BadRequestException('Kein Bild übermittelt');
  const buffer = await data.toBuffer();
  return this.usersService.uploadAvatar(payload.sub, buffer, data.mimetype);
}

@Delete('me/avatar')
@HttpCode(HttpStatus.NO_CONTENT)
deleteAvatar(@CurrentUser() payload: JwtPayload): Promise<void> {
  return this.usersService.deleteAvatar(payload.sub);
}
```

- [ ] **Step 4: Add avatarUrl to pino redaction list**

In `apps/api/src/app.module.ts`, add to the `redact` array:

```ts
'res.body.avatarUrl',
```

- [ ] **Step 5: Build backend to check for TypeScript errors**

```bash
cd c:/Workspace/Klar
pnpm --filter api build
```

Expected: zero errors.

- [ ] **Step 6: Run existing unit tests**

```bash
pnpm --filter api test
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/users/ apps/api/src/app.module.ts
git commit -m "feat: add POST/DELETE /users/me/avatar endpoints with sharp resize"
```

---

## Task 5: Frontend — AuthService + AuthStore

**Files:**
- Modify: `apps/web/src/app/core/auth/auth.service.ts`
- Modify: `apps/web/src/app/core/auth/auth.store.ts`

- [ ] **Step 1: Add uploadAvatar and deleteAvatar to AuthService**

In `apps/web/src/app/core/auth/auth.service.ts`, add after `disableTotp()`:

```ts
uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  return this.http.post<{ avatarUrl: string }>('/api/v1/users/me/avatar', formData, {
    withCredentials: true,
  });
}

deleteAvatar(): Observable<void> {
  return this.http.delete<void>('/api/v1/users/me/avatar', { withCredentials: true });
}
```

- [ ] **Step 2: Add updateAvatar to AuthStore**

In `apps/web/src/app/core/auth/auth.store.ts`, add after `markInitialized()`:

```ts
updateAvatar(avatarUrl: string | null): void {
  const current = this._user();
  if (!current) return;
  this._user.set({ ...current, avatarUrl });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/Workspace/Klar
pnpm --filter web build
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/core/auth/
git commit -m "feat: add uploadAvatar/deleteAvatar to AuthService and updateAvatar to AuthStore"
```

---

## Task 6: klar-header-user — full redesign

**Files:**
- Modify: `apps/web/src/app/shared/ui/klar-header-user.component.ts`

- [ ] **Step 1: Rewrite the component**

Replace the entire file `apps/web/src/app/shared/ui/klar-header-user.component.ts`:

```ts
import { Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BrnPopoverImports } from '@spartan-ng/brain/popover';
import { KlarIconComponent } from '../icons/klar-icon.component';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthService } from '../../core/auth/auth.service';
import { HouseholdStore } from '../../core/household/household.store';

@Component({
  selector: 'klar-header-user',
  standalone: true,
  imports: [BrnPopoverImports, RouterLink, KlarIconComponent],
  template: `
    <brn-popover align="end" [sideOffset]="8">

      <!-- Trigger: 32px flat-initials or photo -->
      <button brnPopoverTrigger type="button"
              class="flex size-8 items-center justify-center rounded-full
                     transition-opacity hover:opacity-80 active:opacity-60 overflow-hidden
                     border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]
                     bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--surface-2))]"
              [title]="authStore.user()?.displayName ?? ''">
        @if (authStore.user()?.avatarUrl) {
          <img [src]="authStore.user()!.avatarUrl!"
               class="size-8 object-cover rounded-full" alt="Avatar" />
        } @else {
          <span class="font-mono text-[11px] font-semibold text-(--color-accent)">
            {{ initials() }}
          </span>
        }
      </button>

      <ng-template brnPopoverContent>
        <div class="min-w-56 rounded-lg border border-(--border) bg-(--surface) py-1
                    shadow-[0_8px_30px_rgba(0,0,0,0.35)]">

          <!-- User section -->
          @if (authStore.user(); as user) {
            <div class="px-3 py-3 border-b border-(--border)">
              <div class="flex items-center gap-3">
                <!-- 40px avatar with upload overlay -->
                <button type="button"
                        class="relative size-10 rounded-full shrink-0 overflow-hidden
                               border border-[color-mix(in_oklab,var(--color-accent)_35%,transparent)]
                               bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--surface-2))]
                               group cursor-pointer"
                        (click)="triggerFileInput()"
                        [disabled]="uploading()"
                        [title]="'Foto ändern'">
                  @if (user.avatarUrl) {
                    <img [src]="user.avatarUrl" class="size-10 object-cover" alt="Avatar" />
                  } @else {
                    <span class="font-mono text-[13px] font-semibold text-(--color-accent)">
                      {{ initials() }}
                    </span>
                  }
                  <!-- Hover overlay -->
                  <div class="absolute inset-0 bg-black/50 flex items-center justify-center
                               opacity-0 group-hover:opacity-100 transition-opacity">
                    @if (uploading()) {
                      <div class="size-3 border border-white/50 border-t-white rounded-full animate-spin"></div>
                    } @else {
                      <klar-icon name="camera" [size]="14" class="text-white" />
                    }
                  </div>
                </button>

                <!-- Hidden file input -->
                <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                       class="hidden" (change)="onFileSelected($event)" />

                <div class="min-w-0 flex-1">
                  <div class="text-[13px] font-medium text-(--text) truncate">{{ user.displayName }}</div>
                  <div class="mt-0.5 text-[11px] text-(--text-muted) truncate">{{ user.email }}</div>
                  <button type="button" (click)="triggerFileInput()"
                          class="mt-1 text-[10px] uppercase tracking-[0.08em] font-medium
                                 text-(--color-accent) cursor-pointer hover:underline">
                    Foto ändern
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Household section -->
          @if (householdStore.activeHousehold(); as hh) {
            <div class="px-3 py-2.5 border-b border-(--border)">
              <div class="text-[9px] uppercase tracking-[0.12em] text-(--text-muted) font-medium mb-2">
                Haushalt
              </div>
              <div class="flex items-center gap-2">
                <div class="flex size-5 items-center justify-center rounded
                            font-mono text-[8px] font-bold text-(--color-expense)
                            bg-[color-mix(in_oklab,var(--color-expense)_12%,var(--surface-2))]
                            border border-[color-mix(in_oklab,var(--color-expense)_30%,transparent)]
                            shrink-0">
                  {{ hh.household.name.slice(0, 2).toUpperCase() }}
                </div>
                <span class="text-[12px] text-(--text-2) truncate flex-1">{{ hh.household.name }}</span>
                <span class="text-[9px] uppercase tracking-[0.08em] text-(--text-muted)">{{ hh.role }}</span>
              </div>
              <a routerLink="/app/haushalt"
                 class="mt-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em]
                        font-medium text-(--text-muted) no-underline hover:text-(--text) transition-colors">
                <klar-icon name="haushalt" [size]="10" />
                Haushalt verwalten
              </a>
            </div>
          }

          <!-- Actions -->
          <div class="py-1">
            <a routerLink="/app/settings"
               class="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.08em]
                      font-medium text-(--text-2) no-underline transition-colors
                      hover:bg-(--surface-2) hover:text-(--text)">
              <klar-icon name="settings" [size]="12" />
              Einstellungen
            </a>
            <div class="h-px bg-(--border) mx-2 my-1"></div>
            <button type="button" (click)="authStore.logout()"
                    class="flex w-full items-center gap-2 px-3 py-2 text-[11px] uppercase
                           tracking-[0.08em] font-medium text-(--color-expense)
                           transition-colors hover:bg-(--surface-2) cursor-pointer">
              <klar-icon name="logout" [size]="12" />
              Abmelden
            </button>
          </div>

        </div>
      </ng-template>
    </brn-popover>
  `,
})
export class KlarHeaderUserComponent {
  protected householdStore = inject(HouseholdStore);
  protected authStore      = inject(AuthStore);
  private   authService    = inject(AuthService);

  protected uploading = signal(false);

  private fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected initials = computed(() => {
    const name = this.authStore.user()?.displayName ?? '';
    return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  });

  protected triggerFileInput(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    try {
      const { avatarUrl } = await firstValueFrom(this.authService.uploadAvatar(file));
      this.authStore.updateAvatar(avatarUrl);
    } catch {
      // Toast handled by ErrorInterceptor
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Workspace/Klar
pnpm --filter web build
```

Expected: zero errors.

- [ ] **Step 3: Check that `camera` icon exists**

```bash
grep -r "camera" c:/Workspace/Klar/apps/web/src/app/shared/icons/ --include="*.ts" -l
```

If no result, open `klar-icon.component.ts` and check which icon name to use for a camera/photo upload. Replace `"camera"` in the template with the correct name (e.g. `"image"`, `"photo"`, `"upload"`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/shared/ui/klar-header-user.component.ts
git commit -m "feat: redesign klar-header-user with single avatar, combined dropdown, avatar upload"
```

---

## Task 7: Top-bar — month as subtitle

**Files:**
- Modify: `apps/web/src/app/layout/top-bar/top-bar.component.html`

- [ ] **Step 1: Rewrite top-bar template**

Replace the entire file `apps/web/src/app/layout/top-bar/top-bar.component.html`:

```html
<header class="w-full border-b border-(--border) px-5 flex items-center justify-between shrink-0 h-[var(--header-height)]">

  <!-- Left: title + month as subtitle -->
  <div class="flex flex-col justify-center gap-0.5">
    <span class="text-[15px] font-medium tracking-[-0.01em] text-(--text) leading-none">
      {{ title() }}
    </span>
    @if (subtitle()) {
      <span class="text-[11px] text-(--text-muted)">{{ subtitle() }}</span>
    } @else {
      <span class="text-[10px] uppercase tracking-[0.1em] font-medium text-(--text-muted) leading-none">
        {{ monthChip() }}
      </span>
    }
  </div>

  <!-- Right: stats + actions + user -->
  <div class="flex items-center h-9 gap-2">

    <!-- Stat badges -->
    @for (stat of stats(); track $index) {
      <div class="flex items-center gap-2 px-3 py-1.5
                  rounded border border-(--border) bg-(--surface)">
        <span class="text-[9px] uppercase tracking-[0.1em] text-(--text-muted)">
          {{ stat.label }}
        </span>
        <span class="text-[14px] font-mono tabular-nums leading-none"
              [ngClass]="statColor(stat.tone)">
          {{ stat.valueCents | klarMoney }}
        </span>
      </div>
    }

    <!-- Action buttons -->
    @if (showPlanspiel()) {
      <button hlmBtn variant="ghost" size="sm" type="button" (click)="planspielClick.emit()">
        <klar-icon name="planspiel" [size]="14" />
        Planspiel
      </button>
    }
    @if (showExport()) {
      <button hlmBtn variant="outline" size="sm" type="button" (click)="exportClick.emit()">
        <klar-icon name="download" [size]="14" />
        PDF
      </button>
    }
    @if (showAdd()) {
      <button hlmBtn variant="default" size="sm" type="button" (click)="addClick.emit()">
        <klar-icon name="plus" [size]="14" />
        {{ addLabel() }}
      </button>
    }

    <klar-header-user />
  </div>
</header>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Workspace/Klar
pnpm --filter web build
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout/top-bar/top-bar.component.html
git commit -m "feat: show month as subtitle in top-bar, remove separate month chip from right"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Start dev environment**

```bash
cd c:/Workspace/Klar
docker compose -f docker/docker-compose.dev.yml up -d
pnpm --filter api prisma:migrate
pnpm dev
```

- [ ] **Step 2: Manual smoke test — header appearance**

Open `http://localhost:4200`. Log in. Check:
- Page title shows on the left with month as subtitle underneath
- Right side: stat badge(s) + action button + single 32px avatar circle
- Avatar shows flat initials (dark bg, accent border, accent text) when no photo uploaded

- [ ] **Step 3: Manual smoke test — avatar upload**

Click the avatar in the top-bar. In the dropdown:
- User name + email visible
- 40px avatar with hover overlay showing camera icon
- "Foto ändern" link present
- Click "Foto ändern" → file picker opens
- Select a JPEG/PNG image
- Spinner appears on avatar during upload
- After upload: avatar shows the uploaded photo in both header and dropdown
- Refresh page → avatar persists (loaded from auth refresh)

- [ ] **Step 4: Manual smoke test — mobile**

Resize to 375px width. Check that mobile header still shows title + month chip + user (unchanged).

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
pnpm --filter api test:e2e
```

Expected: all tests green.

- [ ] **Step 6: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix: header redesign fixups from smoke test"
```
