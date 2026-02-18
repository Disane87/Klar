<p align="center">
  <img src="https://img.shields.io/badge/Denaro-Budget_Tracker-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB5PSIuOWVtIiBmb250LXNpemU9IjkwIj7wn5KwPC90ZXh0Pjwvc3ZnPg==" alt="Denaro" />
</p>

<h1 align="center">Denaro</h1>

<p align="center">
  <strong>A modern, multi-user budget tracking application with shared household finances</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-19-dd0031?style=flat-square&logo=angular" alt="Angular" />
  <img src="https://img.shields.io/badge/NestJS-11-ea2845?style=flat-square&logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169e1?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ed?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/OIDC-Auth-f7931a?style=flat-square&logo=openid" alt="OIDC" />
</p>

---

## Overview

**Denaro** (Italian for "money") is a self-hosted budget tracking application that helps individuals and families manage their monthly fixed costs, track incomes, and see at a glance how much of their salary remains after expenses.

### Key Features

- **Dashboard** with real-time budget overview, donut charts, and spending progress bars
- **Budget Management** — Create, categorize, and track recurring monthly expenses
- **Income Tracking** — Multiple income sources per user per month
- **Category System** — Color-coded budget categories with custom icons
- **Family Mode** — Shared households with combined financial overviews
  - Invite family members via invite codes
  - Per-person income and expense breakdown
  - Role-based access (Admin, Member, Viewer)
- **OIDC Authentication** — Works with Keycloak, Auth0, Google, or any OIDC provider
- **REST API** — Full OpenAPI/Swagger documentation
- **Liquid Glass Design** — Frosted glass UI inspired by iOS, with smooth spring animations
- **Dark Mode** — Automatic light/dark theme support
- **Fully Responsive** — Mobile-first design that works on any device

## Screenshots

> The UI features a **Liquid Glass** design system with frosted glass surfaces, gradient backgrounds, and subtle spring animations throughout the application.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  Angular 19  │     │  NestJS 11   │     │     17        │
│  Tailwind 4  │     │  TypeORM     │     │               │
│  Nginx       │     │  Swagger     │     │               │
└─────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │            ┌──────────────┐
       └───────────▶│ OIDC Provider│
                    │  (Keycloak)  │
                    └──────────────┘
```

## Quick Start with Docker

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- An OIDC provider (e.g., [Keycloak](https://www.keycloak.org/))

### 1. Clone and Configure

```bash
git clone https://github.com/Disane87/Denaro.git
cd Denaro
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Database
DB_PASSWORD=your-secure-password

# OIDC Provider
OIDC_AUTHORITY=https://your-keycloak.example.com/realms/denaro
OIDC_CLIENT_ID=denaro
OIDC_REDIRECT_URI=https://your-domain.com/auth/callback

# CORS
CORS_ORIGIN=https://your-domain.com
```

### 2. Launch

```bash
docker compose up -d
```

The application will be available at `http://localhost` (frontend) and `http://localhost:3000/api/docs` (Swagger API docs).

### 3. Pull from GHCR (Alternative)

```bash
docker pull ghcr.io/disane87/denaro/frontend:latest
docker pull ghcr.io/disane87/denaro/backend:latest
```

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

The API will be running at `http://localhost:3000` with Swagger docs at `/api/docs`.

### Frontend

```bash
cd frontend
npm install
npm start
```

The app will be running at `http://localhost:4200`.

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Project Structure

```
Denaro/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/              # OIDC authentication (JWT strategy)
│   │   ├── users/             # User management
│   │   ├── incomes/           # Income CRUD
│   │   ├── categories/        # Budget category CRUD
│   │   ├── budgets/           # Budget entries & summaries
│   │   ├── households/        # Shared household management
│   │   └── common/            # Guards, decorators, utilities
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # Angular SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # Page & UI components
│   │   │   ├── services/      # API service layer
│   │   │   ├── models/        # TypeScript interfaces
│   │   │   ├── guards/        # Route guards
│   │   │   └── interceptors/  # HTTP interceptors
│   │   ├── environments/      # Environment configs
│   │   └── styles.css         # Liquid Glass design system
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── PRD.md                 # Product Requirements Document
├── .github/workflows/
│   ├── ci.yml                 # CI pipeline (test + build + push)
│   └── release.yml            # Release pipeline (tagged versions)
├── docker-compose.yml         # Full stack deployment
└── .env.example               # Environment template
```

## API Documentation

Once running, visit `/api/docs` for the interactive Swagger UI.

### Key Endpoints

| Method | Endpoint                          | Description                 |
|--------|-----------------------------------|-----------------------------|
| GET    | `/api/auth/config`                | OIDC configuration          |
| GET    | `/api/auth/profile`               | Current user profile        |
| GET    | `/api/incomes`                    | List incomes                |
| POST   | `/api/incomes`                    | Create income               |
| GET    | `/api/categories`                 | List budget categories      |
| POST   | `/api/categories`                 | Create category             |
| GET    | `/api/budgets`                    | List budget entries         |
| POST   | `/api/budgets`                    | Create budget entry         |
| GET    | `/api/budgets/summary`            | Monthly budget summary      |
| GET    | `/api/households`                 | List households             |
| POST   | `/api/households`                 | Create household            |
| POST   | `/api/households/join`            | Join via invite code        |
| GET    | `/api/households/:id/summary`     | Household financial summary |

## OIDC Setup (Keycloak Example)

1. Create a new realm called `denaro`
2. Create a client:
   - **Client ID**: `denaro`
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `public`
   - **Valid Redirect URIs**: `http://localhost:4200/*` (dev) or `https://your-domain.com/*` (prod)
   - **Web Origins**: `http://localhost:4200` or `https://your-domain.com`
3. Set the `OIDC_AUTHORITY` environment variable to `http://your-keycloak:8080/realms/denaro`

## Tech Stack

| Component  | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | Angular 19, Tailwind CSS 4, oidc-client-ts    |
| Backend    | NestJS 11, TypeORM, PostgreSQL 17             |
| Auth       | OpenID Connect (OIDC) with JWT validation     |
| API Docs   | Swagger / OpenAPI via @nestjs/swagger         |
| Testing    | Jest (backend), Karma + Jasmine (frontend)    |
| CI/CD      | GitHub Actions                                |
| Containers | Docker multi-stage builds, GHCR               |
| Proxy      | Nginx (production frontend)                   |

## Design System

Denaro uses a **Liquid Glass** design language inspired by modern iOS:

- **Frosted glass surfaces** with `backdrop-filter: blur(20px)`
- **Semi-transparent backgrounds** with subtle borders
- **Spring animations** using `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Staggered entry animations** for list items
- **Gradient accents** (indigo to emerald)
- **Dark mode** with CSS custom properties

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with care by the Denaro team
</p>
