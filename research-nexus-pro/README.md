# Research-Nexus Pro v1.0

> Industrial-grade research knowledge graph visualization system

## Features

### Three Core Views
- **Problem Evolution Tree**: Interactive timeline showing research problems, their evolution, and relationships
- **Method Targeting Map**: Visual mapping of methods to problems with verification status
- **Domain Swimlane**: Hierarchical domain organization with branch visualization

### Interactive Features
- Linked brushing between views (click a problem/method to highlight related items)
- Layer control for toggling visibility of different elements
- Drag, zoom, and pan on visualization canvas
- Real-time statistics panel

### Data Export
- JSON export (full dataset)
- CSV export (problems table)
- PNG export (visualization snapshot)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:3000

# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker Deployment

```bash
# Build Docker image
docker build -t research-nexus-pro .

# Run container
docker run -p 3000:80 research-nexus-pro
# Open http://localhost:3000
```

## Data Schema

See `schema.json` for the full JSON Schema definition.

### Problem Node
```json
{
  "id": "p1",
  "name": "Problem Name",
  "year": 2023,
  "status": "active",
  "branchId": "b1",
  "description": "Problem description",
  "evolvedFrom": "p0",
  "children": ["p2"]
}
```

Status values: `solved`, `partial`, `active`, `unsolved`, `evolving`, `birth`

### Method Node
```json
{
  "id": "m1",
  "name": "Method Name",
  "type": "verified",
  "targets": ["p1", "p2"],
  "description": "Method description"
}
```

Type values: `verified`, `partial`, `untested`, `failed`

### Branch
```json
{
  "id": "b1",
  "name": "Branch Name",
  "yPosition": 0,
  "color": "#8b5cf6",
  "parentId": "b0"
}
```

## Tech Stack
- React 18 + TypeScript
- Vite 5 (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- React Flow (graph visualization)
- Framer Motion (animations)
- Lucide React (icons)

## Project Structure
```
research-nexus-pro/
├── src/
│   ├── components/
│   │   ├── ProblemEvolutionView.tsx
│   │   ├── MethodTargetView.tsx
│   │   ├── ExportPanel.tsx
│   │   └── LayerOverlay.tsx
│   ├── store/
│   │   └── nexusStore.ts
│   ├── data/
│   │   └── example.json
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   └── main.tsx
├── schema.json
├── example.json
├── Dockerfile
├── package.json
└── README.md
```

## License
MIT
