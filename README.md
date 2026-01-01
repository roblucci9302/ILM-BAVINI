# BAVINI - AI-Powered Web Development Environment

BAVINI is an AI-powered web development agent that allows you to prompt, run, edit, and deploy full-stack applications directly from your browser. It features a sophisticated multi-agent system for complex development tasks.

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo-url> && cd BAVINI && pnpm install

# 2. Configure environment
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local

# 3. Start development
pnpm dev
```

Open http://localhost:5173 in your browser.

## Features

### Core Capabilities

- **Full-Stack in Browser** - Complete development environment powered by WebContainers
  - Install and run npm packages (Vite, Next.js, React, etc.)
  - Run Node.js servers directly in the browser
  - Interact with third-party APIs
  - Deploy to production from chat

- **Multi-Agent System** - 8 specialized AI agents working together
  - **Orchestrator** - Analyzes tasks and coordinates other agents
  - **Explorer** - Code analysis and file exploration
  - **Coder** - Code generation and modification
  - **Builder** - Build system and npm operations
  - **Tester** - Test execution and analysis
  - **Deployer** - Git operations and deployment
  - **Reviewer** - Code quality and review
  - **Fixer** - Bug detection and fixes

- **AI with Full Control** - Complete environment access
  - Filesystem operations
  - Terminal and shell commands
  - Package management
  - Browser console integration

### Preview Features

- Device simulation (Desktop / Tablet / Mobile)
- Fullscreen mode
- Multiple port support

### Persistence

- Chat history with checkpoints
- State recovery with PGlite database
- Auto-save functionality

## Documentation

| Document | Description |
|----------|-------------|
| [BAVINI.md](./BAVINI.md) | Complete technical architecture |
| [GUIDE_BONNES_PRATIQUES](./GUIDE_BONNES_PRATIQUES_DEVELOPPEMENT.md) | Development best practices |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |
| [docs/API.md](./docs/API.md) | API reference |

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Frontend** | React 18, Remix, TypeScript |
| **Styling** | UnoCSS, Radix UI |
| **Editor** | CodeMirror 6 |
| **State** | Nanostores |
| **AI** | Anthropic Claude API |
| **Runtime** | WebContainers API |
| **Database** | PGlite (SQLite in browser) |
| **Testing** | Vitest, Testing Library, Playwright |
| **Deployment** | Cloudflare Pages |

## Development

### Prerequisites

- Node.js >= 18.18.0
- pnpm >= 9.4.0

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server locally |
| `pnpm deploy` | Deploy to Cloudflare Pages |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Lint code with ESLint |
| `pnpm typecheck` | Type check with TypeScript |

### Project Structure

```
app/
├── components/     # React UI components
│   ├── chat/       # Chat interface
│   ├── editor/     # Code editor
│   ├── workbench/  # IDE workspace
│   └── ui/         # Reusable primitives
├── lib/
│   ├── agents/     # Multi-agent system
│   ├── stores/     # Nanostores state
│   ├── hooks/      # React hooks
│   ├── persistence/# Database layer
│   └── services/   # External integrations
├── routes/         # Remix API routes
└── utils/          # Utility functions
```

## Tips

- **Be specific** - Mention frameworks/libraries in your prompts
- **Use enhance** - Click the enhance icon to refine prompts
- **Scaffold first** - Set up basic structure before advanced features
- **Batch instructions** - Combine simple tasks to save time

## Credits

Based on [Bolt.new](https://github.com/stackblitz/bolt.new) by StackBlitz.

## License

**Proprietary License** - Copyright (c) 2025 Robes-pierre Ganro

This software is under proprietary license. See [LICENSE.md](./LICENSE.md) for full terms.

Code portions derived from Bolt.new remain under MIT license. See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for attributions.
