# Implementation Plan — Denaro Budget App

## Phase 1: Foundation

### Backend Scaffolding
- [x] Initialize NestJS project with TypeORM, ConfigModule, Swagger
- [x] Set up PostgreSQL connection with environment-based config
- [x] Create base entity classes with UUID primary keys and timestamps
- [x] Configure global validation pipe and CORS

### Frontend Scaffolding
- [x] Initialize Angular standalone project
- [x] Integrate Tailwind CSS 4
- [x] Create Liquid Glass design system (CSS custom properties, glass components)
- [x] Set up routing with lazy-loaded components
- [x] Configure HTTP interceptor for auth tokens

### DevOps
- [x] Create multi-stage Dockerfiles for backend and frontend
- [x] Set up docker-compose with PostgreSQL, backend, and frontend services
- [x] Configure GitHub Actions CI pipeline (lint, test, build, push to GHCR)
- [x] Configure GitHub Actions release pipeline for tagged versions

## Phase 2: Authentication & Users

### Backend
- [x] Implement JWT strategy with JWKS endpoint validation
- [x] Create `AuthService` for OIDC user provisioning (find-or-create)
- [x] Create `AuthController` with `/auth/config` and `/auth/profile` endpoints
- [x] Create `JwtAuthGuard` and `@CurrentUser()` decorator
- [x] Create `UsersService` with find/create operations

### Frontend
- [x] Integrate `oidc-client-ts` for OIDC code flow
- [x] Create `AuthService` with signals-based state management
- [x] Create login page with Liquid Glass styling
- [x] Create OIDC callback handler
- [x] Create auth guard for protected routes
- [x] Create HTTP interceptor for Bearer token injection

## Phase 3: Budget Core

### Backend
- [x] Create `BudgetCategory` entity with name, icon, color
- [x] Create `Income` entity with amount, month, year
- [x] Create `BudgetEntry` entity with category, amount, recurring flag
- [x] Implement CRUD services and controllers for all entities
- [x] Implement `getSummary()` with category breakdown aggregation

### Frontend
- [x] Create Dashboard with summary cards (income, expenses, remaining)
- [x] Create SVG donut chart for expense breakdown
- [x] Create budget health bars per category
- [x] Create Budget entries list with add/delete
- [x] Create Incomes list with add/delete
- [x] Create Categories manager with color picker

## Phase 4: Family Mode

### Backend
- [x] Create `Household` entity with invite code
- [x] Create `HouseholdMember` join table with role enum
- [x] Implement household CRUD and invite/join flow
- [x] Implement member management (add, update role, remove)
- [x] Implement `getHouseholdSummary()` with per-member breakdown

### Frontend
- [x] Create Households list with create/join forms
- [x] Create Household detail page with:
  - Combined income/expense/remaining summary
  - Per-member contribution breakdown with visual bars
  - Members list with role badges

## Phase 5: Polish & Quality

### Design
- [x] Implement Liquid Glass design system
  - Frosted glass surfaces (`backdrop-filter: blur`)
  - Semi-transparent backgrounds with subtle borders
  - Spring animations (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
  - Staggered entry animations for lists
  - Gradient backgrounds with animated blobs
- [x] Dark mode support via CSS custom properties
- [x] Responsive layout (mobile hamburger menu, flexible grids)
- [x] Custom scrollbar styling

### Testing
- [x] Backend unit tests for all services (Users, Auth, Incomes, Budgets, Households)
- [x] Frontend unit tests for services (Budget, Income, Household)
- [x] Frontend component tests (Dashboard)

### Documentation
- [x] Product Requirements Document (PRD)
- [x] Implementation Plan (this document)
- [x] README with setup instructions, architecture diagram, API reference
- [x] OpenAPI/Swagger auto-generated docs
- [x] Environment variable templates (`.env.example`)

## Future Enhancements

- [ ] Monthly budget templates (auto-copy recurring entries)
- [ ] Multi-currency support
- [ ] CSV/Excel import/export
- [ ] Push notifications for budget threshold alerts
- [ ] Trend charts (month-over-month comparison)
- [ ] PWA support with offline capability
- [ ] End-to-end tests with Cypress/Playwright
- [ ] Kubernetes Helm chart for production deployments
