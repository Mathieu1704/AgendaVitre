# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LVM Agenda** — a full-stack application for managing window cleaning service operations (scheduling, clients, invoicing, team management).

## Architecture

Monorepo with two applications:
- `apps/backend/` — FastAPI (Python) REST API
- `apps/mobile/` — React Native (Expo) cross-platform app (iOS, Android, Web)

**External services:** Supabase (PostgreSQL + Auth), Railway (backend hosting), Resend (email), WeasyPrint (PDF generation), Google Calendar integration.

## Development Commands

### Start all services (recommended)
```bash
npm run dev
```
Runs concurrently: local Supabase, FastAPI backend on port 8000, and Expo dev server.

### Backend only
```bash
cd apps/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Mobile only
```bash
cd apps/mobile
npx expo start
# Press 'w' for web, 'i' for iOS simulator, 'a' for Android emulator
```

### Backend setup (first time)
```bash
cd apps/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python init_db.py  # Initialize/migrate database schema
```

### Mobile setup (first time)
```bash
cd apps/mobile
npm install
```

## Backend Architecture (`apps/backend/`)

- **Entry point:** `main.py` — FastAPI app, CORS config, router registration
- **Auth:** `app/core/deps.py` — JWT validation via `get_current_user` dependency; token comes from Supabase Auth
- **Models:** `app/models/models.py` — SQLAlchemy 2.0 ORM (Employee, Client, Intervention, InterventionItem, Absence, CompanySettings)
- **Schemas:** `app/schemas/schemas.py` — Pydantic request/response validation
- **Routers:** `app/routers/` — one file per domain (interventions, employees, clients, planning, absences)
- **Config:** `app/core/config.py` — loads `.env` settings
- **Business logic:** `calculate_day_stats` in `planning.py` for capacity calculations

Key relationships: Employee ↔ Intervention (many-to-many), Client → Intervention (one-to-many), Intervention → InterventionItem (one-to-many with cascade delete).

All primary keys are UUIDs. DateTime fields are timezone-aware.

## Mobile Architecture (`apps/mobile/`)

- **Routing:** Expo Router (file-based, like Next.js) under `app/`
  - `(auth)/` — login, OAuth callback (public routes)
  - `(app)/` — protected routes (calendar, clients, facturation, parametres)
- **API client:** `src/lib/api.ts` — Axios instance that auto-injects Supabase Bearer token via interceptors
- **Data fetching:** React Query (TanStack) hooks in `src/hooks/` (useInterventions, useClients, useEmployees, usePlanning)
- **Auth state:** `src/hooks/useAuth.ts` — wraps Supabase session
- **Supabase client:** `src/lib/supabase.ts` — uses SecureStore on mobile, localStorage on web
- **UI:** React Native Paper + NativeWind (Tailwind CSS classes)
- **Types:** `src/types.ts` — shared TypeScript interfaces

## Environment Variables

**Backend (`.env`):** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `RESEND_API_KEY`

**Mobile (`.env`):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`

Production API URL: `https://api.lvmagenda.be`

## Role-Based Access

Two roles: `admin` and `employee`. Role is stored on the `Employee` model (synced with Supabase Auth user ID). Admins can manage team, access all planning stats; employees see their own schedule. Role checks happen both in backend route guards and in mobile UI conditional rendering.
