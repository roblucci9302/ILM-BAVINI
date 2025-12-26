# BAVINI - AI-Powered Web Development

BAVINI is an AI-powered web development agent that allows you to prompt, run, edit, and deploy full-stack applications directly from your browser.

## Features

- **Full-Stack in the Browser**: Integrates cutting-edge AI models with an in-browser development environment powered by WebContainers
  - Install and run npm tools and libraries (Vite, Next.js, and more)
  - Run Node.js servers
  - Interact with third-party APIs
  - Deploy to production from chat

- **AI with Environment Control**: AI models have complete control over the entire environment including the filesystem, node server, package manager, terminal, and browser console

## Getting Started

### Prerequisites

- Node.js >= 18.18.0
- pnpm 9.4.0

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd BAVINI-20
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up your API key:
   ```bash
   echo "ANTHROPIC_API_KEY=your-api-key-here" > .env
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. Open http://localhost:5173 in your browser

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server locally |
| `pnpm deploy` | Deploy to Cloudflare Pages |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint code |
| `pnpm typecheck` | Type check TypeScript |

## Tips and Tricks

- **Be specific about your stack**: Mention specific frameworks or libraries in your initial prompt
- **Use the enhance prompt icon**: Click the 'enhance' icon to refine your prompt before sending
- **Scaffold the basics first**: Make sure the basic structure is in place before adding advanced features
- **Batch simple instructions**: Combine simple instructions into one message to save time

## Credits

Based on [Bolt.new](https://github.com/stackblitz/bolt.new) by StackBlitz.

## License

**Proprietary License** - Copyright (c) 2025 Robes-pierre Ganro

Ce logiciel est sous licence propriétaire. Voir [LICENSE.md](LICENSE.md) pour les termes complets.

Les portions de code dérivées de Bolt.new restent sous licence MIT. Voir [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) pour les attributions.
