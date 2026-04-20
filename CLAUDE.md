# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Research-Nexus Pro is a full-stack research knowledge graph visualization system (触觉-视觉融合研究知识图谱系统). It transforms research papers into an interactive network of problems, methods, and citations. The frontend is React 18 + TypeScript + Vite; the backend is Python FastAPI with a zero-Docker architecture (SQLite + NetworkX + NumPy).

## Development Commands

### One-shot startup (starts both frontend and backend)
```bash
./start-research-nexus.sh
```
Frontend will be on `http://localhost:5173`, backend on `http://localhost:8000`, API docs at `http://localhost:8000/docs`.

### Frontend (run from repo root)
```bash
npm install       # install deps
npm run dev       # dev server (port 3000 per vite.config.ts)
npm run build     # tsc + vite build
npm run preview   # preview production build
```

### Backend (run from `backend/` directory)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.api.main_local   # starts on port 8000
```

### Backend tests
```bash
cd backend
source venv/bin/activate
pytest backend/tests/          # run all tests
pytest backend/tests/e2e/      # run e2e tests only
```

There are **no frontend test/lint scripts** defined in `package.json`.

### Environment setup
Copy `.env.example` to `.env` and set `COGNEE_LLM_API_KEY` if you need LLM-driven features. The system runs without it in mock mode.

## High-Level Architecture

### Frontend

- **Entry**: `src/main.tsx` mounts the app with `BrowserRouter`, GSAP provider, and i18n (en + zh).
- **Routing**: `src/AppRoutes.tsx` defines 12+ views including problem-tree, method-tree, dual-tree, citation, timeline, innovation-board, paper-repository, user-workspace.
- **State**: Six Zustand stores in `src/store/`:
  - `appStore.ts` — core app state (problems, methods, papers, active view, bookmarks, undo/redo)
  - `v3Store.ts` — V3 domain map and innovation board data
  - `paperGenerationStore.ts` — paper generation state + favorites
  - `userStore.ts` — user/workspace state
  - `configStore.ts` — app configuration from backend
  - `nexusStore.ts` — legacy branch state
- **Views are lazy-loaded** in `App.tsx`. The app has a persistent 240px sidebar, dark/light mode toggle, and keyboard shortcuts (Ctrl+Z undo, Ctrl+Y redo, Ctrl+B bookmarks, Escape close panels).
- **Data hydration**: Static JSON (`src/data/real_papers.json`) + backend API (`/api/v3/domain-map`, `/api/papers`).
- **Animation**: GSAP (`src/animations/`) for page load sequences and view transitions; Framer Motion for component animations.
- **Visualization**: ReactFlow for citation networks and graph views; D3 for custom timelines and trees.

### Backend

- **Entry**: `backend/app/api/main_local.py` — FastAPI app factory, version 2.1.0.
- **Zero-Docker data layer**:
  - `backend/app/database/local_graph.py` — SQLite + NetworkX graph database
  - `backend/app/database/local_vector.py` — NumPy-based local vector database
- **API routes** (registered in `main_local.py`):
  - `/api/` — local routes (problems, methods, papers, skills)
  - `/api/v3/` — V3 strict schema routes (domain-map, evidence, innovation board)
  - `/api/v3/` — paper generation routes
  - `/api/v3/autoresearch` — AutoResearchClaw routes
  - `/api/innovation` — innovation discovery routes
  - `/api/cognee` — Cognee V2 knowledge graph routes
- **Skills system** in `backend/app/skills/`: `skill_1_extract.py`, `skill_2_query_gaps.py`, `skill_3_cross_domain.py`, `skill_4_merge_nodes.py`.
- **CORS** is pre-configured for localhost ports 3000-3005 and 5173-5184.

### Data Flow

1. **Ingestion**: PDF -> Kimi extraction -> Pydantic schema -> fastembed vectorization -> SQLite/NetworkX storage.
2. **Alignment**: Cosine similarity > 0.85 triggers node convergence; < 0.85 creates new nodes.
3. **Innovation Discovery**: Graph traversal finds "dangling problems" + "cross-domain methods" -> generates innovation points on the Innovation Board.
4. **Frontend**: Hydrates from static JSON + backend API -> renders 12 interactive views.

### Domain Model

The system is organized around **6 real domains** defined in `src/config/domains.ts`: `multi_agent`, `agent_memory`, `agent_tools`, `llm_reasoning`, `robotics`, `general`. The core philosophy is: research = Problem Tree (where we want to go) + Method Tree (tools we have) + their cross-domain intersections.

## Key Configuration

- `vite.config.ts`: base path is `/Research-Nexus-Pro-/` (GitHub Pages). Path alias `@` -> `./src`. Dev server proxies `/api` to `http://localhost:8000`.
- `tsconfig.json`: Strict mode, path alias `@/*` -> `src/*`.
- `tailwind.config.js`: Dark mode via `class`, custom status colors (solved/active/unsolved/partial).
- The repo is on the `gh-pages` branch (current branch), with `main` as the usual PR target.

## Important Files

- `EXTRACTED_DATA.json` — core static data (required at runtime)
- `src/data/real_papers.json` — frontend static paper data
- `backend/data/research_graph.db` — SQLite graph database
- `backend/requirements.txt` — Python dependencies including FastAPI, Pydantic, pytest, mypy, black, flake8

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
