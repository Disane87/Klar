# Product Requirements Document (PRD) — Denaro

## 1. Overview

**Denaro** is a multi-user budget tracking application that helps individuals and families manage their monthly fixed costs, budgets, and salaries. Users can see at a glance how much of their income remains after expenses, share budget overviews with family members, and collaboratively manage household finances.

## 2. Problem Statement

Managing monthly fixed costs across a household is tedious. Existing tools are either too complex (full accounting software) or too simple (spreadsheets). Families with multiple incomes need a shared view of their combined financial situation without sharing credentials.

## 3. Target Users

- **Individuals** tracking personal monthly budgets
- **Families / Households** with multiple earners who need shared financial overviews
- **Self-hosters** who want full control over their financial data

## 4. Core Features

### 4.1 Authentication & Multi-User (OIDC)
- OpenID Connect (OIDC) based authentication
- Support for any OIDC-compliant provider (Keycloak, Auth0, Google, etc.)
- User profiles with display name and avatar
- Role-based access: Owner, Member, Viewer

### 4.2 Budget Management
- Create, edit, and delete monthly budgets
- Define budget categories (e.g., Rent, Utilities, Groceries, Subscriptions)
- Set fixed monthly amounts per category
- Support for recurring and one-time expenses
- Monthly budget templates that auto-populate each month

### 4.3 Income Tracking
- Add multiple income sources per user
- Track net salary per month
- Support for variable income (bonuses, freelance)

### 4.4 Dashboard
- Overview of total income vs. total expenses
- Remaining budget displayed prominently
- Monthly trend charts
- Category breakdown (pie/donut chart)
- Quick-add expense button

### 4.5 Shared Overviews (Family Mode)
- Create shared households
- Invite members via link or email
- Combined income view across all members
- Per-person expense breakdown
- Shared budget categories
- Permission levels: Admin (full control), Member (add expenses), Viewer (read-only)

### 4.6 REST API
- Full CRUD for all resources
- OpenAPI/Swagger documentation
- JWT-based API authentication
- Rate limiting

## 5. Non-Functional Requirements

### 5.1 Design
- **Liquid Glass** design language (inspired by iOS 26)
- Frosted glass effects with backdrop blur
- Subtle spring animations on interactions
- Light and dark mode support
- Fully responsive (mobile-first)

### 5.2 Performance
- Dashboard loads in under 2 seconds
- API response times under 200ms for standard operations

### 5.3 Deployment
- Docker containerized (multi-stage builds)
- Published to GitHub Container Registry (ghcr.io)
- Docker Compose for easy self-hosting
- Environment-based configuration

### 5.4 Quality
- Unit test coverage for all services and components
- GitHub Actions CI/CD pipeline
- Linting and formatting enforcement

## 6. Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Angular 21, Tailwind CSS 4          |
| Backend    | NestJS 11, TypeORM, PostgreSQL      |
| Auth       | OpenID Connect (passport-openidconnect) |
| API Docs   | Swagger / OpenAPI                   |
| Testing    | Jest (backend), Karma/Jasmine (frontend) |
| CI/CD      | GitHub Actions                      |
| Deployment | Docker, Docker Compose, GHCR       |

## 7. Data Model (High-Level)

```
User
├── id (UUID)
├── oidcSubject (string, unique)
├── email (string)
├── displayName (string)
├── avatarUrl (string, nullable)
└── createdAt / updatedAt

Household
├── id (UUID)
├── name (string)
├── inviteCode (string, unique)
└── createdAt / updatedAt

HouseholdMember
├── householdId (FK → Household)
├── userId (FK → User)
└── role (enum: ADMIN, MEMBER, VIEWER)

Income
├── id (UUID)
├── userId (FK → User)
├── householdId (FK → Household, nullable)
├── name (string)
├── amount (decimal)
├── month (int)
├── year (int)
└── createdAt / updatedAt

BudgetCategory
├── id (UUID)
├── householdId (FK → Household, nullable)
├── userId (FK → User, nullable)
├── name (string)
├── icon (string)
├── color (string)
└── createdAt / updatedAt

BudgetEntry
├── id (UUID)
├── categoryId (FK → BudgetCategory)
├── userId (FK → User)
├── householdId (FK → Household, nullable)
├── name (string)
├── amount (decimal)
├── isRecurring (boolean)
├── month (int)
├── year (int)
└── createdAt / updatedAt
```

## 8. API Endpoints (Summary)

| Method | Endpoint                          | Description                   |
|--------|-----------------------------------|-------------------------------|
| GET    | /api/auth/login                   | Initiate OIDC login           |
| GET    | /api/auth/callback                | OIDC callback                 |
| GET    | /api/auth/profile                 | Get current user profile      |
| POST   | /api/auth/logout                  | Logout                        |
| GET    | /api/incomes                      | List user incomes             |
| POST   | /api/incomes                      | Create income                 |
| PUT    | /api/incomes/:id                  | Update income                 |
| DELETE | /api/incomes/:id                  | Delete income                 |
| GET    | /api/categories                   | List budget categories        |
| POST   | /api/categories                   | Create category               |
| PUT    | /api/categories/:id               | Update category               |
| DELETE | /api/categories/:id               | Delete category               |
| GET    | /api/budgets                      | List budget entries           |
| POST   | /api/budgets                      | Create budget entry           |
| PUT    | /api/budgets/:id                  | Update budget entry           |
| DELETE | /api/budgets/:id                  | Delete budget entry           |
| GET    | /api/budgets/summary              | Monthly summary               |
| GET    | /api/households                   | List user households          |
| POST   | /api/households                   | Create household              |
| POST   | /api/households/join              | Join via invite code          |
| GET    | /api/households/:id               | Get household details         |
| GET    | /api/households/:id/summary       | Household financial summary   |
| GET    | /api/households/:id/members       | List household members        |
| PUT    | /api/households/:id/members/:uid  | Update member role            |
| DELETE | /api/households/:id/members/:uid  | Remove member                 |

## 9. Milestones

1. **Foundation** — Project scaffolding, Docker setup, CI pipeline
2. **Auth & Users** — OIDC integration, user management
3. **Budget Core** — Categories, incomes, budget entries, dashboard
4. **Family Mode** — Households, shared overviews, invites
5. **Polish** — Animations, responsive design, dark mode
6. **Release** — Documentation, GHCR publishing, v1.0 tag
