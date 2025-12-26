# BAVINI - Documentation Technique

> Assistant IA de développement web full-stack avec exécution de code en temps réel.

**Dernière mise à jour:** 2025-12-23
**Tests:** 878 passants (45 fichiers) | **TypeScript:** Strict mode | **Build:** Production ready

---

## Table des matières

1. [Architecture](#1-architecture)
2. [Technologies](#2-technologies)
3. [Flux de données](#3-flux-de-données)
4. [State Management](#4-state-management)
5. [Connecteurs](#5-connecteurs)
6. [Patterns de composants](#6-patterns-de-composants)
7. [API & Backend](#7-api--backend)
8. [Tests](#8-tests)
9. [Conventions](#9-conventions)
10. [Dark/Light Mode Guidelines](#10-darklight-mode-guidelines)
11. [OAuth Authentication](#11-oauth-authentication)
12. [Procédure de Tests par Phase](#12-procédure-de-tests-par-phase)
13. [Checklists](#13-checklists)
14. [UI Guidelines - Design Minimaliste](#14-ui-guidelines---design-minimaliste)
15. [Changelog - Audit et Nettoyage](#15-changelog---audit-et-nettoyage-2025-12-23)
16. [Méthodologie de Transformation - Sprint par Sprint](#16-méthodologie-de-transformation---sprint-par-sprint)
17. [Phase 1: Fondations - Plan Détaillé](#17-phase-1-fondations---plan-détaillé)

---

## 1. Architecture

### Structure des dossiers

```
/app
├── components/
│   ├── chat/              # Interface de chat (BaseChat, Messages, etc.)
│   ├── editor/            # Éditeur de code (CodeMirror)
│   ├── header/            # Header et navigation
│   ├── sidebar/           # Sidebar (historique, menu)
│   ├── ui/                # Composants UI réutilisables
│   └── workbench/         # Panel IDE (code/preview)
├── lib/
│   ├── .server/           # Code serveur uniquement
│   │   └── llm/           # Intégration LLM, prompts, streaming
│   ├── git/               # Opérations Git (clone, commit, push)
│   ├── hooks/             # Hooks React personnalisés
│   ├── persistence/       # Base de données chat (PGLite)
│   ├── pyodide/           # Exécution Python dans le navigateur
│   ├── runtime/           # Action runner, message parser
│   ├── stores/            # State management (Nanostores)
│   └── webcontainer/      # Intégration WebContainer API
├── routes/                # Routes Remix
│   ├── _index.tsx         # Page principale
│   ├── chat.$id.tsx       # Chat avec ID
│   ├── api.chat.ts        # Endpoint streaming LLM
│   └── api.enhancer.ts    # Endpoint amélioration prompt
├── styles/                # Styles globaux (SCSS)
├── types/                 # Définitions TypeScript
├── utils/                 # Fonctions utilitaires
├── entry.client.tsx       # Point d'entrée client
├── entry.server.tsx       # Point d'entrée serveur
└── root.tsx               # Layout racine

/functions                 # Cloudflare Workers
/icons                     # Icônes SVG pour UnoCSS
/public                    # Assets statiques
```

### Principes architecturaux

| Principe | Application dans BAVINI |
|----------|-------------------------|
| **Separation of Concerns** | `.server/` pour code serveur, `.client.tsx` pour code client |
| **Component-based** | React avec composants atomiques et composés |
| **Store pattern** | Nanostores pour état global léger |
| **Streaming-first** | LLM et actions via streams pour UX réactive |

---

## 2. Technologies

### Stack principal

| Catégorie | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Framework** | Remix | 2.10.2 | Full-stack SSR |
| **UI** | React | 18.2.0 | Composants |
| **Build** | Vite | 5.3.1 | Bundler & dev server |
| **Types** | TypeScript | 5.5.2 | Type safety |
| **Styling** | UnoCSS | 0.61.3 | Utility-first CSS |
| **State** | Nanostores | 0.10.3 | État global léger |
| **Animation** | Framer Motion | 11.2.12 | Animations UI |
| **3D** | Three.js | 0.182.0 | Background animé |

### Intégrations clés

| Intégration | Technologie | Usage |
|-------------|-------------|-------|
| **LLM** | Anthropic Claude | Génération de code |
| **Éditeur** | CodeMirror 6 | Édition de code |
| **Runtime** | WebContainer | Node.js dans le navigateur |
| **Python** | Pyodide | Python WebAssembly |
| **Git** | Isomorphic Git | Opérations Git |
| **Database** | PGLite | Persistance chat |
| **Terminal** | xterm.js | Émulation terminal |

### Dépendances de développement

| Outil | Usage |
|-------|-------|
| **Vitest** | Tests unitaires |
| **ESLint** | Linting (@blitz/eslint-plugin) |
| **Prettier** | Formatage |
| **Wrangler** | CLI Cloudflare |
| **pnpm** | Package manager |

---

## 3. Flux de données

### Requête utilisateur → Réponse LLM

```
┌─────────────────────────────────────────────────────────────────┐
│  User Input (Chat)                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Chat.client.tsx (useChat hook)                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/chat                                                 │
│  → streamText() avec Anthropic Claude                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  StreamingMessageParser                                         │
│  → Parse XML tags (boltArtifact, boltAction)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ActionRunner                                                   │
│  → Execute: file, shell, git, python                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Stores (Nanostores)                                            │
│  → FilesStore, EditorStore, WorkbenchStore                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  UI Components                                                  │
│  → Workbench, EditorPanel, Preview, Terminal                    │
└─────────────────────────────────────────────────────────────────┘
```

### Types d'actions

| Type | Description | Exécution |
|------|-------------|-----------|
| `file` | Créer/modifier fichier | WebContainer.fs.writeFile() |
| `shell` | Commande shell | WebContainer.spawn() |
| `git` | Opérations Git | Isomorphic Git |
| `python` | Code Python | Pyodide runtime |

---

## 4. State Management

### Stores Nanostores

```typescript
// Atoms (valeur unique)
themeStore          // 'dark' | 'light'
chatStore           // { started, aborted, showChat }
chatId              // ID du chat actuel

// Maps (collections clé-valeur)
EditorStore.documents       // path → EditorDocument
FilesStore.files            // path → File/Folder
WorkbenchStore.artifacts    // messageId → ArtifactState
ActionRunner.actions        // actionId → ActionState
```

### Patterns d'utilisation

```typescript
// Dans un composant React
import { useStore } from '@nanostores/react';
import { themeStore } from '~/lib/stores/theme';

function MyComponent() {
  const theme = useStore(themeStore);  // Réactif
  return <div>{theme}</div>;
}

// Accès direct (hors React)
const currentTheme = themeStore.get();
themeStore.set('dark');

// Map store
filesStore.setKey(filePath, { type: 'file', content });
```

### Persistance HMR

Les stores sont préservés pendant le Hot Module Reload via `import.meta.hot?.data`.

---

## 5. Connecteurs

BAVINI intègre 14 connecteurs pour étendre ses capacités avec des services tiers.

### Vue d'ensemble

| Catégorie | Connecteurs | Description |
|-----------|-------------|-------------|
| **Partagés** | Supabase, Stripe, Shopify, ElevenLabs, Perplexity, Firecrawl, Netlify | Services accessibles par toute l'équipe |
| **Personnels** | Figma, GitHub, Atlassian, Linear, Miro, n8n, Notion | Services liés au compte personnel |

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  UI: ConnectorsPanel / ConnectorCard                             │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  Validation: lib/connectors/validators.ts                        │
│  → Vérification API pour 8 connecteurs                           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  Store: lib/stores/connectors.ts                                 │
│  → État + persistance localStorage                               │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  Sync: Synchronisation bidirectionnelle GitHub ↔ git-settings   │
└──────────────────────────────────────────────────────────────────┘
```

### Connecteurs avec validation API

| Connecteur | Endpoint de validation | Token requis |
|------------|----------------------|--------------|
| GitHub | `api.github.com/user` | Personal Access Token |
| Supabase | `{url}/rest/v1/` | URL + anon key |
| Stripe | `api.stripe.com/v1/balance` | Secret key |
| Notion | `api.notion.com/v1/users/me` | Integration token |
| Linear | `api.linear.app/graphql` | API key |
| Netlify | `api.netlify.com/api/v1/user` | Personal access token |
| Figma | `api.figma.com/v1/me` | Personal access token |
| ElevenLabs | `api.elevenlabs.io/v1/user` | API key |

### Obtention des tokens

#### GitHub
1. Aller sur [github.com/settings/tokens](https://github.com/settings/tokens)
2. Cliquer "Generate new token (classic)"
3. Sélectionner les scopes: `repo`, `read:user`
4. Copier le token généré

#### Supabase
1. Ouvrir votre projet sur [supabase.com](https://supabase.com)
2. Aller dans Settings → API
3. Copier l'URL du projet et la clé `anon` (publique)

#### Stripe
1. Aller sur [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Copier la "Secret key" (commence par `sk_`)

#### Notion
1. Aller sur [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Créer une nouvelle intégration
3. Copier le "Internal Integration Token"

#### Linear
1. Aller dans Settings → API → Personal API keys
2. Créer une nouvelle clé
3. Copier le token généré

#### Netlify
1. Aller sur [app.netlify.com/user/applications](https://app.netlify.com/user/applications)
2. Créer un nouveau "Personal access token"
3. Copier le token généré

#### Figma
1. Aller sur [figma.com/developers/api#access-tokens](https://www.figma.com/developers/api#access-tokens)
2. Générer un "Personal access token"
3. Copier le token généré

#### ElevenLabs
1. Aller sur [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)
2. Créer une nouvelle clé API
3. Copier la clé générée

### Utilisation dans le code

```typescript
import { useStore } from '@nanostores/react';
import { connectorsStore, isConnectorConnected } from '~/lib/stores/connectors';

// Vérifier si un connecteur est actif
const isGithubConnected = isConnectorConnected('github');

// Accéder aux credentials
const connectors = useStore(connectorsStore);
const githubToken = connectors.github.credentials.token;
```

---

## 6. Patterns de composants

### Types de composants

| Suffixe | Type | Exemple |
|---------|------|---------|
| `.tsx` | Universel (SSR + client) | `Header.tsx` |
| `.client.tsx` | Client uniquement | `Chat.client.tsx` |
| `.server/` | Serveur uniquement | `lib/.server/llm/` |

### Patterns courants

**1. Memo + useStore**
```typescript
export const ThemeSwitch = memo(({ className }: Props) => {
  const theme = useStore(themeStore);
  return <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} />;
});
```

**2. ClientOnly wrapper**
```typescript
<ClientOnly fallback={<Skeleton />}>
  {() => <Chat />}
</ClientOnly>
```

**3. forwardRef pour composants réutilisables**
```typescript
export const BaseChat = React.forwardRef<HTMLDivElement, Props>(
  (props, ref) => <div ref={ref} {...props} />
);
```

### Hooks personnalisés

| Hook | Rôle |
|------|------|
| `useChat()` | Streaming messages (ai/react) |
| `useMessageParser()` | Parse XML du LLM |
| `useChatHistory()` | Load/save depuis PGLite |
| `usePromptEnhancer()` | Amélioration de prompt |
| `useShortcuts()` | Raccourcis clavier |
| `useSnapScroll()` | Auto-scroll messages |

---

## 7. API & Backend

### Endpoints

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/chat` | POST | Streaming LLM |
| `/api/enhancer` | POST | Amélioration prompt |

### Structure requête /api/chat

```typescript
// Input
{
  messages: Message[]  // Historique conversation
}

// Output
Streaming text/plain (chunks)
```

### System Prompt

Le prompt système (`lib/.server/llm/prompts.ts`) définit :
- Comportement de l'IA
- Contraintes WebContainer
- Limitations Python/Pyodide
- Format des artifacts XML
- Conventions de code (2 espaces, etc.)

---

## 8. Tests

### Configuration

```typescript
// vitest via vite.config.ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./app/test/setup.ts'],
  include: ['app/**/*.spec.{ts,tsx}'],
}
```

### Fichiers de tests actuels

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `action-runner.spec.ts` | 21 | Runtime actions |
| `message-parser.spec.ts` | 36 | XML parsing |
| `operations.spec.ts` | 31 | Git operations |
| `pyodide.spec.ts` | 21 | Python runtime |
| `db.spec.ts` | 20 | Database |
| `file-sync.spec.ts` | 18 | Git file sync |
| `pglite.spec.ts` | 17 | PGLite |
| `ColorBends.spec.tsx` | 12 | UI component |
| `migration.spec.ts` | 11 | DB migrations |
| `cors-proxy.spec.ts` | 23 | CORS proxy |
| `git-settings.spec.ts` | 8 | Git settings |
| `UserMessage.spec.tsx` | 8 | UI component |
| `AnimatedPlaceholder.spec.tsx` | 6 | UI component |
| `Header.spec.tsx` | 5 | UI component |
| `theme.spec.ts` | 9 | Theme store |
| `connectors.spec.ts` | 51 | Connectors store + sync |
| `ConnectorIcon.spec.tsx` | 24 | Connector icons |
| `ConnectorCard.spec.tsx` | 13 | Connector card UI |
| `ConnectorsPanel.spec.tsx` | 9 | Connectors panel |
| `SettingsModal.spec.tsx` | 8 | Settings modal |
| `validators.spec.ts` | 27 | API validators |
| `classNames.spec.ts` | 17 | Utility functions |
| `stripIndent.spec.ts` | 13 | String utilities |
| `unreachable.spec.ts` | 5 | Error utilities |
| `promises.spec.ts` | 6 | Promise utilities |
| `debounce.spec.ts` | 8 | Debounce utility |
| `buffer.spec.ts` | 6 | Buffer utilities |
| `diff.spec.ts` | 23 | Diff utilities |
| `markdown.spec.ts` | 13 | Markdown config |
| `useShortcuts.spec.ts` | 8 | Keyboard shortcuts |
| `useSnapScroll.spec.ts` | 6 | Scroll hook |
| `usePromptEnhancer.spec.ts` | 10 | Prompt enhancement |
| `chat.spec.ts` | 10 | Chat store |
| `settings.spec.ts` | 6 | Settings store |
| `github/api.spec.ts` | 22 | GitHub API client |
| `github.spec.ts` | 17 | GitHub store |
| `GitHubPanel.spec.tsx` | 16 | GitHub panel UI |
| `auth/oauth.spec.ts` | 41 | OAuth core utilities |
| `auth/tokens.spec.ts` | 38 | Token management |
| `auth/providers/providers.spec.ts` | 39 | OAuth providers |

**Total: 878 tests** (45 fichiers)

### Commandes

```bash
pnpm run test          # Exécution unique
pnpm run test:watch    # Mode watch
pnpm run typecheck     # Vérification types
```

### Convention de nommage

- Fichier: `ComponentName.spec.tsx` ou `module.spec.ts`
- Describe: Nom du composant/module
- It: `should + comportement attendu`

```typescript
describe('ThemeStore', () => {
  it('should default to dark theme', () => {
    expect(DEFAULT_THEME).toBe('dark');
  });
});
```

---

## 9. Conventions

### Commits (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Maintenance, dépendances |
| `docs` | Documentation |
| `style` | Formatage (pas de changement de code) |
| `refactor` | Refactoring |
| `test` | Ajout/modification de tests |
| `perf` | Amélioration de performance |

**Exemples:**
```
feat: Add animated gradient to BAVINI logo
fix: Remove flickering in AnimatedPlaceholder
chore: Fix lint errors and add missing tests
```

### Nommage des fichiers

| Type | Convention | Exemple |
|------|------------|---------|
| Composant | PascalCase | `BaseChat.tsx` |
| Composant client | `.client.tsx` | `Chat.client.tsx` |
| Store | camelCase | `theme.ts` |
| Hook | `use` + PascalCase | `useMessageParser.ts` |
| Test | `.spec.tsx/.ts` | `Header.spec.tsx` |
| Style module | `.module.scss` | `BaseChat.module.scss` |
| Utilitaire | camelCase | `classNames.ts` |

### Style de code

- **Indentation:** 2 espaces
- **Quotes:** Single quotes
- **Semicolons:** Oui
- **Trailing commas:** ES5
- **Imports:** Utiliser `~/` (alias pour `/app`)

```typescript
// Correct
import { themeStore } from '~/lib/stores/theme';

// Incorrect
import { themeStore } from '../../lib/stores/theme';
```

### Commentaires

- Minuscules pour les commentaires de code
- Pas de majuscule en début de ligne

```typescript
// correct: this is a comment
// Incorrect: This is a comment
```

---

## 10. Dark/Light Mode Guidelines

Le mode **Dark** est le mode par défaut de BAVINI. Toute nouvelle implémentation UI (boutons, animations, composants, etc.) doit respecter les design patterns des deux modes.

### Principes fondamentaux

| Principe | Description |
|----------|-------------|
| **Dark-first** | Le mode dark est le défaut (`DEFAULT_THEME = 'dark'`) |
| **Cohérence visuelle** | Tous les composants doivent être testés dans les deux modes |
| **Variables sémantiques** | Utiliser les variables `bolt-elements-*` plutôt que des couleurs fixes |
| **Transitions fluides** | Utiliser `transition-colors` pour les changements d'état |

### Palette de couleurs

#### Mode Dark (défaut)

| Usage | Classe UnoCSS | Exemple |
|-------|---------------|---------|
| **Background principal** | `bg-bolt-elements-background-depth-1` | Inputs, zones de saisie |
| **Background secondaire** | `bg-bolt-elements-background-depth-2` | Panneaux, sidebars |
| **Background tertiaire** | `bg-bolt-elements-background-depth-3` | Cards, badges |
| **Texte principal** | `text-bolt-elements-textPrimary` | Titres, contenu important |
| **Texte secondaire** | `text-bolt-elements-textSecondary` | Descriptions, labels |
| **Texte tertiaire** | `text-bolt-elements-textTertiary` | Placeholders, hints |
| **Bordures** | `border-bolt-elements-borderColor` | Contours par défaut |
| **Bordures hover** | `hover:border-bolt-elements-borderColorHover` | États hover |
| **Accent** | `text-accent-500`, `bg-accent-500/10` | Éléments interactifs, focus |

#### États visuels

| État | Classes recommandées |
|------|---------------------|
| **Succès/Connecté** | `bg-green-500/5`, `border-green-500/30`, `text-green-400` |
| **Erreur** | `bg-red-500/10`, `border-red-500/30`, `text-red-400` |
| **Warning** | `bg-yellow-500/10`, `border-yellow-500/30`, `text-yellow-400` |
| **Info/Sélectionné** | `bg-accent-500/10`, `border-accent-500/30`, `text-accent-500` |

### Boutons

```typescript
// Bouton primaire
className="bg-bolt-elements-button-primary-background
           text-bolt-elements-button-primary-text
           hover:bg-bolt-elements-button-primary-backgroundHover
           rounded-md transition-colors"

// Bouton secondaire
className="bg-bolt-elements-button-secondary-background
           text-bolt-elements-button-secondary-text
           hover:bg-bolt-elements-button-secondary-backgroundHover
           rounded-md transition-colors"

// Bouton danger (déconnecter, supprimer)
className="bg-red-500/10 text-red-400 hover:bg-red-500/20
           rounded-md transition-colors"
```

### Inputs

```typescript
className="w-full px-3 py-2 rounded-md
           bg-bolt-elements-background-depth-1
           border border-bolt-elements-borderColor
           text-bolt-elements-textPrimary
           placeholder:text-bolt-elements-textTertiary
           focus:outline-none focus:border-accent-500
           transition-colors"
```

### Animations

```typescript
import { cubicEasingFn } from '~/utils/easings';

// Transition standard
const transition = { duration: 0.2, ease: cubicEasingFn };

// Container avec stagger
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

// Item variants
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition },
};
```

### Badges et Counters

```typescript
// Badge standard
className="text-xs px-2 py-0.5 rounded-full
           bg-bolt-elements-background-depth-3
           text-bolt-elements-textSecondary"

// Badge de statut connecté
className="text-xs px-2 py-0.5 rounded-full
           bg-green-500/20 text-green-400"
```

### Checklist pour nouvelles intégrations UI

Avant de soumettre une PR avec des modifications UI, vérifier :

```markdown
## Design Patterns Dark/Light Mode

### Couleurs
- [ ] Utiliser les variables `bolt-elements-*` pour backgrounds
- [ ] Utiliser les variables `bolt-elements-text*` pour les couleurs de texte
- [ ] Utiliser les variables `bolt-elements-borderColor*` pour les bordures
- [ ] NE PAS utiliser de couleurs fixes (sauf pour états: rouge erreur, vert succès)

### Boutons
- [ ] Utiliser `bolt-elements-button-primary-*` pour boutons principaux
- [ ] Utiliser `bolt-elements-button-secondary-*` pour boutons secondaires
- [ ] Inclure `transition-colors` sur tous les boutons
- [ ] Utiliser `rounded-md` (pas `rounded-lg`)

### Inputs
- [ ] Background: `bg-bolt-elements-background-depth-1`
- [ ] Bordure: `border-bolt-elements-borderColor`
- [ ] Focus: `focus:border-accent-500`
- [ ] Placeholder: `placeholder:text-bolt-elements-textTertiary`

### Animations
- [ ] Importer `cubicEasingFn` depuis `~/utils/easings`
- [ ] Définir `transition` avec `duration: 0.2`
- [ ] Utiliser `motion.div`, `motion.button` pour animations Framer Motion
- [ ] Utiliser `AnimatePresence` pour les éléments conditionnels

### Tests visuels
- [ ] Tester en mode Dark (par défaut)
- [ ] Tester en mode Light
- [ ] Vérifier le contraste et la lisibilité
- [ ] Vérifier les états hover, focus, active, disabled
```

### Vérification des patterns

Les patterns de design sont vérifiés par ESLint et les tests de composants. Pour chaque nouveau composant UI, vérifier manuellement ou via tests dédiés :

1. Import de `cubicEasingFn` pour les animations
2. Utilisation des classes `bolt-elements-*` pour le theming
3. Présence de `transition-colors` pour les états
4. Utilisation de `memo()` pour l'optimisation
5. Classes appropriées pour chaque état (default, hover, focus, error, success)

> **Note:** Les fichiers `design-patterns.spec.ts` et `dark-mode-patterns.spec.ts` ont été supprimés (283 tests) car ils testaient la présence de patterns dans le code source plutôt que le comportement réel. Ces vérifications sont mieux gérées par ESLint/linters.

---

## 11. OAuth Authentication

BAVINI intègre un système d'authentification OAuth 2.0 pour les connecteurs supportés.

### Providers OAuth supportés

| Provider | OAuth | PKCE | Token Expiration |
|----------|-------|------|------------------|
| **GitHub** | ✅ | Non | Non (permanent) |
| **Figma** | ✅ | Non | Oui (refresh token) |
| **Notion** | ✅ | Non | Non (permanent) |

### Architecture OAuth

```
┌─────────────────────────────────────────────────────────────────┐
│  UI: ConnectorCard (Bouton "Se connecter via OAuth")            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Route: /api/auth/:provider                                      │
│  → Génère state, code_verifier (PKCE)                            │
│  → Stocke dans cookie sécurisé                                   │
│  → Redirige vers authorization URL du provider                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Provider OAuth (GitHub, Figma, Notion)                          │
│  → Utilisateur autorise l'application                            │
│  → Redirect vers callback avec code                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Route: /api/auth/callback                                       │
│  → Valide state (CSRF protection)                                │
│  → Échange code contre token                                     │
│  → Stocke token dans localStorage                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Store: lib/auth/tokens.ts                                       │
│  → Gestion tokens (access, refresh, expiration)                  │
│  → Sync avec connectorsStore                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Structure des fichiers OAuth

```
app/lib/auth/
├── oauth.ts                 # Core: PKCE, state, token exchange
├── tokens.ts                # Token storage avec nanostores
├── index.ts                 # Exports centralisés
└── providers/
    ├── github.ts            # Configuration GitHub
    ├── figma.ts             # Configuration Figma
    ├── notion.ts            # Configuration Notion
    └── index.ts             # Registry des providers

app/routes/
├── api.auth.$provider.ts    # Initie le flow OAuth
├── api.auth.callback.ts     # Callback après autorisation
└── api.auth.refresh.ts      # Refresh tokens expirés
```

### Intégration Store (Phase 2)

Le store `connectors.ts` intègre maintenant OAuth avec synchronisation bidirectionnelle:

```typescript
// Types d'authentification
export type AuthMethod = 'oauth' | 'api_key';

// Fonctions OAuth principales
isOAuthConnector(id: ConnectorId): boolean      // Vérifie si OAuth
getAuthMethod(id: ConnectorId): AuthMethod      // Retourne la méthode
getOAuthConnectors(): ConnectorConfig[]         // Liste OAuth
getApiKeyConnectors(): ConnectorConfig[]        // Liste API key
initiateOAuth(id: ConnectorId): void            // Lance le flow OAuth
handleOAuthSuccess(providerId: string): void    // Post-callback
disconnectOAuthConnector(id: ConnectorId): void // Déconnexion OAuth
needsTokenRefresh(id: ConnectorId): boolean     // Token expiré?
```

Connecteurs OAuth configurés:
- **GitHub** (`authMethod: 'oauth'`) - repositories, issues
- **Figma** (`authMethod: 'oauth'`) - design files
- **Notion** (`authMethod: 'oauth'`) - pages, databases

Le store `git-settings.ts` est maintenant synchronisé automatiquement avec le token OAuth GitHub et inclut un champ `source: 'oauth' | 'manual'`.

### Composant ConnectorCard (Phase 3)

Le composant `ConnectorCard` détecte automatiquement le type d'authentification:

**Connecteurs OAuth:**
- Badge "OAuth" bleu affiché pour les connecteurs non connectés
- Bouton "Se connecter" avec icône (redirige vers provider)
- Pas de formulaire - redirection directe via `initiateOAuth()`
- Déconnexion via `disconnectOAuthConnector()`

**Connecteurs API Key:**
- Bouton "Connecter" ouvre le formulaire
- Validation des champs requis
- Validation API avant connexion

### Validations de Sécurité PKCE (Phase 4)

Fonctions de validation pour la sécurité OAuth:

```typescript
// Validation du code_verifier (RFC 7636)
isValidCodeVerifier(verifier: string): boolean  // 43-200 chars, base64url

// Validation du code_challenge
isValidCodeChallenge(challenge: string): boolean // 43 chars SHA-256

// Validation du state (CSRF)
isValidState(state: string): boolean  // 32+ chars, URL-safe

// Comparaison constant-time (anti timing attacks)
secureCompare(a: string, b: string): boolean

// Validation basique des tokens
isValidToken(token: string): boolean  // 10-4096 chars
```

### Tests d'Intégration OAuth (Phase 5)

Tests d'intégration couvrant le flux OAuth complet:

- **Full PKCE Flow**: Génération verifier/challenge, vérification déterministe
- **State Management**: Validation, expiration, détection de tampering
- **Provider Support**: Compatibilité GitHub, Figma, Notion
- **Security Tests**: Comparaisons constant-time, prévention timing attacks
- **Error Scenarios**: Gestion données vides/null/malformées
- **Cookie Simulation**: Cycle de vie complet state cookie

Fichier: `app/routes/api.auth.integration.spec.ts` (21 tests)

### Configuration Cloudflare

Les secrets OAuth doivent être configurés via Cloudflare Dashboard ou `wrangler`:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put FIGMA_CLIENT_ID
wrangler secret put FIGMA_CLIENT_SECRET
wrangler secret put NOTION_CLIENT_ID
wrangler secret put NOTION_CLIENT_SECRET
```

### Développement local

Créer `.dev.vars` à partir de `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
# Éditer .dev.vars avec vos credentials OAuth
```

### Sécurité

| Mesure | Implémentation |
|--------|---------------|
| **CSRF Protection** | State parameter unique + validation |
| **PKCE** | Code verifier/challenge (pour providers supportés) |
| **Secure Cookies** | HttpOnly, SameSite=Lax, Secure en production |
| **Token Storage** | localStorage (considérer encryption future) |
| **State Expiration** | 10 minutes max pour compléter le flow |
| **Constant-time comparison** | Pour validation state |

### Tests OAuth

Les tests couvrent :
- `oauth.spec.ts`: PKCE generation, state validation, token exchange
- `tokens.spec.ts`: Token storage, expiration, persistence
- `providers.spec.ts`: Provider configurations, user fetching

---

## 12. Procédure de Tests par Phase

Lors du développement de fonctionnalités complexes en plusieurs phases, chaque phase DOIT être testée et validée avant de passer à la suivante.

### Processus obligatoire

```
┌───────────────────────────────────────────────────────────────────┐
│  Phase N: Implémentation                                           │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│  Tests Automatisés                                                 │
│  1. Créer les fichiers .spec.ts pour chaque module                │
│  2. Couvrir: unitaires, intégration, cas limites                  │
│  3. Exécuter: pnpm test -- path/to/module/                        │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│  Validation                                                        │
│  1. Tous les tests passent (0 failures)                           │
│  2. TypeScript: pnpm run typecheck                                │
│  3. Lint: pnpm run lint                                           │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│  Documentation                                                     │
│  1. Mettre à jour BAVINI.md avec nouveau compte de tests          │
│  2. Documenter les nouveaux modules/fonctions                     │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│  Commit & Push                                                     │
│  1. Commit avec message conventionnel                             │
│  2. Push vers la branche                                          │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│  Phase N+1: Continuer                                              │
└───────────────────────────────────────────────────────────────────┘
```

### Checklist de tests par phase

```markdown
## Tests de fin de phase

### Tests automatisés
- [ ] Créer fichier(s) `*.spec.ts` pour chaque nouveau module
- [ ] Tests unitaires: fonctions individuelles
- [ ] Tests d'intégration: interactions entre modules
- [ ] Tests cas limites: erreurs, timeouts, valeurs nulles
- [ ] Exécuter `pnpm test -- path/to/module/`
- [ ] ✅ 0 tests en échec

### Validation qualité
- [ ] `pnpm run typecheck` passe sans erreur
- [ ] `pnpm run lint` passe sans erreur
- [ ] `pnpm run build` compile sans erreur

### Documentation
- [ ] Mettre à jour le compte de tests dans BAVINI.md
- [ ] Ajouter les nouveaux tests au tableau des tests
- [ ] Documenter les nouveaux patterns/modules si applicable
```

### Couverture minimale requise

| Type de module | Tests requis |
|----------------|--------------|
| **Store** | État initial, mutations, persistance, erreurs |
| **Route API** | Requêtes valides, erreurs 4xx/5xx, authentification |
| **Composant UI** | Rendu, props, états, interactions |
| **Utilitaire** | Cas normaux, cas limites, types edge |
| **OAuth** | Flow complet, CSRF, expiration, refresh |

### Commandes de test

```bash
# Tester un module spécifique
pnpm test -- app/lib/auth/

# Tester avec verbose
pnpm test -- --reporter=verbose app/lib/auth/

# Tester tous les fichiers modifiés
pnpm test -- --changed

# Voir la couverture
pnpm test -- --coverage
```

---

## 13. Checklists

### Ajouter une nouvelle fonctionnalité

```markdown
## Préparation
- [ ] Créer une branche: `git checkout -b feat/nom-feature`
- [ ] Comprendre l'architecture existante (lire ce doc)

## Développement
- [ ] Créer les composants dans `app/components/`
- [ ] Créer les stores si nécessaire dans `app/lib/stores/`
- [ ] Ajouter les types dans `app/types/` si nécessaire
- [ ] Utiliser les conventions de nommage

## Tests
- [ ] Créer `ComponentName.spec.tsx` pour chaque composant
- [ ] Créer `module.spec.ts` pour chaque module
- [ ] Couvrir: rendu, props, états, cas limites
- [ ] Exécuter: `pnpm run test`

## Qualité
- [ ] TypeScript: `pnpm run typecheck`
- [ ] Lint: `pnpm run lint`
- [ ] Build: `pnpm run build`

## Finalisation
- [ ] Commit avec message conventionnel
- [ ] Push et créer PR
- [ ] Review et merge
```

### Ajouter un nouveau composant UI

```markdown
- [ ] Créer `app/components/ui/ComponentName.tsx`
- [ ] Exporter depuis le fichier (named export)
- [ ] Utiliser `memo()` si le composant est pur
- [ ] Supporter le thème dark/light via `dark:` classes
- [ ] Créer `ComponentName.spec.tsx` avec tests
- [ ] Documenter les props avec TypeScript
```

### Ajouter un nouveau store

```markdown
- [ ] Créer `app/lib/stores/storeName.ts`
- [ ] Définir les types d'état
- [ ] Utiliser `atom()` pour valeurs simples, `map()` pour collections
- [ ] Exporter les fonctions d'action
- [ ] Créer `storeName.spec.ts` avec tests
- [ ] Préserver l'état HMR si nécessaire
```

### Modifier le thème

```markdown
- [ ] Vérifier les variables dans `app/styles/variables.scss`
- [ ] Utiliser `dark:` prefix pour styles dark mode
- [ ] Tester en mode light ET dark
- [ ] Vérifier la lisibilité et le contraste
```

### Ajouter une route API

```markdown
- [ ] Créer `app/routes/api.routeName.ts`
- [ ] Définir le loader ou action
- [ ] Valider les inputs
- [ ] Gérer les erreurs proprement
- [ ] Documenter le format request/response
```

---

## 14. UI Guidelines - Design Minimaliste

BAVINI adopte un design minimaliste inspiré de Lovable. Chaque élément UI doit être simple, lisible et fonctionnel.

### Principes fondamentaux

| Principe | Application |
|----------|-------------|
| **Minimalisme** | Moins c'est mieux - retirer tout élément non essentiel |
| **Lisibilité** | Textes clairs, contrastes suffisants, espacement aéré |
| **Fonctionnalité** | Chaque élément doit avoir une fonction claire |
| **Cohérence** | Design uniforme sur toute l'application |

### À éviter

| Élément | Pourquoi l'éviter |
|---------|-------------------|
| **Compteurs/Badges inutiles** | "0/14 actifs" - surcharge visuelle, pas d'information utile |
| **Descriptions longues** | Encombrent l'interface, l'icône + nom suffit généralement |
| **Badges de type** | "OAuth", "API Key" - détail technique non pertinent pour l'utilisateur |
| **Labels de boutons verbeux** | Préférer icônes expressives (sign-in, sign-out) |
| **Séparations de sections** | "Partagés" vs "Personnels" - simplifier en liste unique |

### Pattern: Cards minimalistes

```typescript
// ✅ BON: Card compacte et lisible
<div className="flex items-center gap-3 p-3">
  <Icon className="w-6 h-6" />
  <span className="text-sm font-medium">{name}</span>
  {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
  <button className="ml-auto">
    <span className="i-ph:sign-in text-sm" />
  </button>
</div>

// ❌ MAUVAIS: Card surchargée
<div className="p-4">
  <Icon className="w-8 h-8" />
  <h3>{name}</h3>
  <span className="badge">OAuth</span>
  <span className="badge">Connecté</span>
  <p className="description">{longDescription}</p>
  <button className="btn-large">Se connecter via OAuth</button>
</div>
```

### Pattern: Boutons d'action

```typescript
// ✅ BON: Bouton icône discret
className="px-2.5 py-1 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
<span className="i-ph:sign-in text-sm" />

// ❌ MAUVAIS: Bouton verbeux et voyant
className="px-4 py-2 bg-accent-500 text-white rounded-lg"
<>Se connecter via OAuth →</>
```

### Pattern: Indicateurs de statut

```typescript
// ✅ BON: Point simple
{isConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}

// ❌ MAUVAIS: Badge avec texte et animation
<motion.span className="badge bg-green-500/20">
  <span className="animate-pulse" />
  Connecté avec succès
</motion.span>
```

### Dimensions recommandées

| Élément | Taille |
|---------|--------|
| **Icons dans cards** | `w-6 h-6` (compact) |
| **Icons dans boutons** | `text-sm` ou `text-lg` |
| **Padding cards** | `p-3` (compact) |
| **Texte cards** | `text-sm` |
| **Boutons inline** | `px-2.5 py-1 text-xs` |
| **Gap entre éléments** | `gap-2` ou `gap-3` |

### Checklist nouveau composant UI

```markdown
## Design Minimaliste

### Avant de soumettre
- [ ] L'élément est-il vraiment nécessaire ?
- [ ] Peut-on remplacer du texte par une icône ?
- [ ] Les badges/compteurs apportent-ils une valeur ?
- [ ] Les descriptions peuvent-elles être retirées ?
- [ ] Le composant utilise les tailles compactes (p-3, text-sm) ?
- [ ] Les boutons sont-ils discrets (icônes seules) ?
- [ ] Les indicateurs sont-ils simples (points de couleur) ?
```

---

## 15. Changelog - Audit et Nettoyage (2025-12-23)

### Tests obsolètes supprimés

Les fichiers de tests suivants ont été supprimés car ils ne testaient pas le comportement réel mais vérifiaient la présence de patterns dans le code source :

| Fichier supprimé | Tests | Raison |
|------------------|-------|--------|
| `design-patterns.spec.ts` | 144 | Tests de patterns basés sur lecture de fichiers source - duplique ESLint |
| `dark-mode-patterns.spec.ts` | 139 | Idem - tests fragiles dépendant de la structure du code |

**Total supprimé:** 283 tests (2 fichiers)

### Corrections TypeScript (Phase 1)

Correction de 20 erreurs TypeScript `error is of type 'unknown'` dans les services:
- `atlassian/index.ts`, `figma/index.ts`, `github/index.ts`, `miro/index.ts`
- `netlify/index.ts`, `notion/index.ts`, `shopify/index.ts`, `stripe/index.ts`
- `supabase/index.ts`, `github/api.ts`, `action-runner.ts`

### Améliorations sécurité (Phase 2)

- Documentation des 3 utilisations sûres de `dangerouslySetInnerHTML` (Shiki codeToHtml)
- Remplacement de 15+ `console.log/error` par le scoped logger dans:
  - Routes API (`api.chat.ts`, `api.enhancer.ts`)
  - Runtime (`action-runner.ts`, `switchable-stream.ts`)
  - Stores (`files.ts`, `auth/tokens.ts`)

### Qualité de code (Phase 3)

- Résolution du FIXME dans `useChatHistory.ts` (documenté comme comportement intentionnel)
- Correction des erreurs ESLint/Prettier (formatage auto + variables non utilisées)
- 56 fichiers reformatés

---

## Ressources

### Documentation externe

- [Remix Docs](https://remix.run/docs)
- [Nanostores](https://github.com/nanostores/nanostores)
- [UnoCSS](https://unocss.dev/)
- [Vitest](https://vitest.dev/)
- [WebContainer](https://webcontainers.io/)

### Commandes utiles

```bash
# Développement
pnpm run dev           # Serveur dev

# Build
pnpm run build         # Build production
pnpm run start         # Serveur production local

# Qualité
pnpm run typecheck     # Vérification TypeScript
pnpm run lint          # ESLint
pnpm run test          # Tests

# Git
git log --oneline -10  # Derniers commits
```

---

## 16. Méthodologie de Transformation - Sprint par Sprint

Cette méthodologie définit comment transformer BAVINI en plateforme 5 étoiles de manière itérative et contrôlée.

### Philosophie

```
❌ NE PAS FAIRE: Tout lancer d'un coup
   → Trop massif, risque de dette technique
   → Difficile de tester/valider en cours de route
   → Si une phase a des problèmes, tout est bloqué

✅ FAIRE: Approche Sprint par Sprint
   → Itératif: résultats visibles à chaque étape
   → Flexible: ajustement des priorités possible
   → Testable: chaque phase est validée
   → Feedback rapide: tester après chaque phase
```

### Flux de travail

```
Phase 1: Fondations     ──────────────────────────►  OBLIGATOIRE D'ABORD
         │
         ▼
    [DÉTAILLER Phase N]  → Valider avec l'équipe → Exécuter → Tester
         │
         ▼
    [REVIEW & RETROSPECTIVE]  → Ajuster si nécessaire
         │
         ▼
    [DÉTAILLER Phase N+1]  → Répéter le cycle
         │
         ▼
        ...
```

### Processus par Phase

#### Étape 1: Détailler la Phase

Avant d'exécuter une phase, créer un document détaillé avec :

```markdown
## Phase X: [Nom de la Phase]

### Objectif
Description claire de ce que cette phase accomplit.

### Fichiers à créer/modifier
| Fichier | Action | Description |
|---------|--------|-------------|
| path/to/file.ts | Créer | Description |
| path/to/existing.ts | Modifier | Ce qui change |

### Architecture technique
Diagrammes, schémas, flux de données.

### Dépendances
- Ce qui doit être fait avant
- Packages npm à installer

### Tests requis
- [ ] Test 1
- [ ] Test 2

### Critères de "Done"
- [ ] Critère 1
- [ ] Critère 2
```

#### Étape 2: Validation avec l'équipe

- Présenter le plan détaillé
- Recueillir les feedbacks
- Ajuster si nécessaire
- Obtenir l'approbation avant exécution

#### Étape 3: Exécution

```markdown
## Checklist d'exécution

### Pré-exécution
- [ ] Créer branche: `git checkout -b feat/phase-x-nom`
- [ ] Vérifier que les tests actuels passent

### Pendant l'exécution
- [ ] Suivre le plan fichier par fichier
- [ ] Committer régulièrement (atomic commits)
- [ ] Mettre à jour les tests

### Post-exécution
- [ ] `pnpm run test` - Tous les tests passent
- [ ] `pnpm run typecheck` - Pas d'erreurs TypeScript
- [ ] `pnpm run lint` - Pas d'erreurs ESLint
- [ ] `pnpm run build` - Build réussi
```

#### Étape 4: Review & Retrospective

```markdown
## Review de Phase

### Résultats
- [ ] Objectif atteint
- [ ] Tous les critères de "Done" validés
- [ ] Documentation mise à jour

### Retrospective
- Ce qui a bien fonctionné
- Ce qui pourrait être amélioré
- Leçons pour les prochaines phases

### Décision
- [ ] Phase validée → Passer à la suivante
- [ ] Ajustements nécessaires → Itérer
```

### Ordre des Phases (Roadmap)

| Phase | Nom | Prérequis | Score Cible |
|-------|-----|-----------|-------------|
| **1** | Fondations (Sécurité, Performance, Stabilité) | Aucun | Production-ready |
| **2** | Sites Web 5/5 | Phase 1 | ★★★★★ |
| **3** | Applications 5/5 | Phase 1 | ★★★★★ |
| **4** | E-commerce 5/5 | Phase 1, (2 ou 3) | ★★★★★ |
| **5** | Entreprise 5/5 | Phase 1, 3 | ★★★★★ |
| **6** | Différenciation | Phases 1-5 | 🚀 Unique |

### Critères de Passage de Phase

Une phase est considérée "terminée" quand :

```markdown
## Critères obligatoires

### Qualité
- [ ] 0 erreurs TypeScript (`pnpm run typecheck`)
- [ ] 0 erreurs ESLint (`pnpm run lint`)
- [ ] Build réussi (`pnpm run build`)
- [ ] Tous les tests passent (`pnpm run test`)

### Fonctionnel
- [ ] Toutes les features de la phase fonctionnent
- [ ] Tests E2E pour les flows critiques (si applicable)
- [ ] Pas de régression sur les features existantes

### Documentation
- [ ] BAVINI.md mis à jour
- [ ] Changelog de la phase documenté
- [ ] Nouveaux patterns documentés si applicable

### Sécurité
- [ ] Pas de nouvelles vulnérabilités introduites
- [ ] Audit des dépendances (`pnpm audit`)
- [ ] Secrets correctement gérés
```

### Template de Document de Phase

Utiliser ce template pour chaque nouvelle phase :

```markdown
# BAVINI - Phase X: [Nom]

**Date de début:** YYYY-MM-DD
**Date de fin prévue:** YYYY-MM-DD
**Responsable:** [Nom]

## Objectif

[Description de l'objectif en 2-3 phrases]

## Contexte

### État actuel
- Point 1
- Point 2

### État cible
- Point 1
- Point 2

## Plan d'exécution détaillé

### X.1 [Sous-tâche 1]

**Fichiers:**
| Fichier | Action | Lignes estimées |
|---------|--------|-----------------|
| ... | ... | ... |

**Code:**
\`\`\`typescript
// Exemple de code à implémenter
\`\`\`

**Tests:**
- [ ] Test 1
- [ ] Test 2

### X.2 [Sous-tâche 2]
...

## Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| ... | ... | ... | ... |

## Critères de Done

- [ ] Critère 1
- [ ] Critère 2
- [ ] Tests passent
- [ ] Documentation à jour

## Changelog

### [Date] - [Auteur]
- Action effectuée
```

### Benchmarks à atteindre

| Catégorie | Actuel | Cible | Métriques |
|-----------|--------|-------|-----------|
| **Prototypage** | ★★★★★ | ★★★★★ | Maintenir |
| **Sites Web** | ★★★★☆ | ★★★★★ | Templates, Deploy 1-click, Figma import |
| **Applications** | ★★★☆☆ | ★★★★★ | Backend, Auth, DB, Tool Use 14 connectors |
| **E-commerce** | ★★☆☆☆ | ★★★★★ | Shopify deep, Stripe complet |
| **Entreprise** | ★★☆☆☆ | ★★★★★ | SSO/SAML, RBAC, Teams, Audit, SDK |

### Leaders à étudier

| Outil | Forces à s'inspirer |
|-------|---------------------|
| **Claude Code** | Checkpoints, Subagents parallèles, SDK |
| **OpenAI Codex** | Multi-tâches, Slack integration, Enterprise |
| **Bolt.new** | Deploy 1-click, Preview live, WebContainer |
| **Lovable.dev** | Figma import, Multiplayer, Shopify partnership |
| **Cursor** | Multi-modèles, Agent mode, Fortune 500 |

---

## 17. Phase 1: Fondations - Plan Détaillé

> **⚠️ PHASE OBLIGATOIRE** - Doit être exécutée avant toute autre phase.

### Objectif

Corriger les bloquants production, renforcer la sécurité, et optimiser les performances de base.

### Vue d'ensemble

| Sous-phase | Description | Priorité |
|------------|-------------|----------|
| 1.1 | Stabiliser les dépendances | 🔴 Critique |
| 1.2 | Sécurité renforcée | 🔴 Critique |
| 1.3 | Performance initiale | 🟠 Haute |
| 1.4 | Tests E2E | 🟠 Haute |
| 1.5 | Documentation & Validation | 🟡 Moyenne |

---

### 1.1 Stabiliser les Dépendances

**Problèmes actuels:**
```
⚠️ @webcontainer/api 1.3.0-internal.10 → VERSION INTERNE (pas stable)
⚠️ @ai-sdk/anthropic 0.0.39 → VERSION BETA (pas stable)
⚠️ pnpm 9.4.0 → Ancien (current: 10.x)
```

**Actions:**

| Action | Fichier | Description |
|--------|---------|-------------|
| Mettre à jour @webcontainer/api | `package.json` | Version stable publique |
| Mettre à jour @ai-sdk/anthropic | `package.json` | Version stable (1.x) |
| Mettre à jour pnpm | `package.json` | packageManager field |
| Mettre à jour compatibility_date | `wrangler.toml` | Date récente |
| Audit sécurité | - | `pnpm audit --fix` |

**Tests:**
- [ ] `pnpm install` réussit sans warnings
- [ ] `pnpm run build` réussit
- [ ] `pnpm run dev` fonctionne
- [ ] Aucune régression fonctionnelle

---

### 1.2 Sécurité Renforcée

**Problèmes actuels:**
- ❌ Tokens OAuth stockés en localStorage plaintext
- ❌ Pas de Content-Security-Policy (XSS possible)
- ❌ Pas de rate limiting sur /api/chat
- ❌ Pas de validation des inputs avec Zod

**Actions:**

#### 1.2.1 Content Security Policy

| Fichier | Action |
|---------|--------|
| `app/entry.server.tsx` | Ajouter headers CSP |
| `wrangler.toml` | Configurer headers Cloudflare |

```typescript
// Headers CSP à ajouter
const cspHeader = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.anthropic.com https://api.github.com ...",
    "frame-src 'self' blob:",
  ].join('; '),
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

#### 1.2.2 Rate Limiting

| Fichier | Action |
|---------|--------|
| `app/lib/security/rate-limiter.ts` | Créer module rate limiting |
| `app/routes/api.chat.ts` | Appliquer rate limiting |
| `app/routes/api.enhancer.ts` | Appliquer rate limiting |

```typescript
// Stratégie: Simple in-memory avec Cloudflare Durable Objects fallback
interface RateLimitConfig {
  windowMs: number;      // 60000 (1 minute)
  maxRequests: number;   // 20 requests
}
```

#### 1.2.3 Validation des Inputs

| Fichier | Action |
|---------|--------|
| `app/lib/validation/schemas.ts` | Créer schémas Zod |
| `app/routes/api.chat.ts` | Valider input avec Zod |
| `app/routes/api.enhancer.ts` | Valider input avec Zod |
| `package.json` | Déplacer zod de devDeps vers deps |

```typescript
// Exemple schéma
import { z } from 'zod';

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(100000),
  })).max(100),
});
```

#### 1.2.4 Encryption des Credentials

| Fichier | Action |
|---------|--------|
| `app/lib/security/encryption.ts` | Créer module encryption |
| `app/lib/stores/connectors.ts` | Utiliser encryption pour credentials |
| `app/lib/auth/tokens.ts` | Utiliser encryption pour tokens |

```typescript
// Stratégie: AES-GCM avec clé dérivée de l'identifiant session
// Note: Amélioration significative mais pas parfaite (clé côté client)
```

**Tests:**
- [ ] CSP headers présents dans toutes les réponses
- [ ] Rate limiting bloque après N requêtes
- [ ] Validation rejette les inputs invalides
- [ ] Credentials encryptés dans localStorage

---

### 1.3 Performance Initiale

**Problèmes actuels:**
- Pyodide: 305MB chargé au démarrage
- PGLite: 3MB chargé au démarrage
- TTI: 5-10 secondes

**Actions:**

#### 1.3.1 Lazy Loading Pyodide

| Fichier | Action |
|---------|--------|
| `app/lib/pyodide/index.ts` | Charger on-demand |
| `app/lib/runtime/action-runner.ts` | Lazy init Pyodide |

```typescript
// Avant: import au démarrage
// Après: import dynamique à la première utilisation Python
let pyodidePromise: Promise<PyodideInterface> | null = null;

export async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({ ... });
  }
  return pyodidePromise;
}
```

#### 1.3.2 Lazy Loading PGLite

| Fichier | Action |
|---------|--------|
| `app/lib/persistence/db.ts` | Charger on-demand |
| `app/lib/hooks/useChatHistory.ts` | Lazy init DB |

```typescript
// Charger PGLite uniquement quand on accède à l'historique
```

#### 1.3.3 Code Splitting

| Fichier | Action |
|---------|--------|
| `vite.config.ts` | Configurer chunks manuels |

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'pyodide': ['pyodide'],
        'pglite': ['@electric-sql/pglite'],
        'codemirror': ['@codemirror/state', '@codemirror/view', ...],
        'three': ['three'],
      }
    }
  }
}
```

**Tests:**
- [ ] TTI < 3 secondes (sans Pyodide/PGLite)
- [ ] Pyodide chargé uniquement à la première commande Python
- [ ] PGLite chargé uniquement à l'ouverture de l'historique
- [ ] Bundle principal < 500KB gzipped

---

### 1.4 Tests E2E

**Problèmes actuels:**
- Aucun test E2E
- Pas de Playwright/Cypress

**Actions:**

| Fichier | Action |
|---------|--------|
| `package.json` | Ajouter @playwright/test |
| `playwright.config.ts` | Créer configuration |
| `e2e/` | Créer dossier tests E2E |

**Tests E2E à créer:**

```typescript
// e2e/auth.spec.ts
- [ ] OAuth GitHub flow complet
- [ ] OAuth Figma flow complet
- [ ] Déconnexion

// e2e/chat.spec.ts
- [ ] Envoyer un message
- [ ] Recevoir une réponse streaming
- [ ] Créer un artifact
- [ ] Exécuter du code

// e2e/connectors.spec.ts
- [ ] Configurer un connecteur API key
- [ ] Valider la connexion
- [ ] Déconnecter
```

**Critères:**
- [ ] `pnpm run test:e2e` passe
- [ ] Coverage des flows critiques

---

### 1.5 Documentation & Validation

**Actions:**

| Fichier | Action |
|---------|--------|
| `.env.example` | Créer avec toutes les variables |
| `BAVINI.md` | Mettre à jour avec changements Phase 1 |
| `README.md` | Mettre à jour instructions setup |

**Variables d'environnement à documenter:**

```bash
# .env.example
# OAuth Providers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FIGMA_CLIENT_ID=
FIGMA_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# API Keys
ANTHROPIC_API_KEY=

# Optional
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
```

---

### Critères de Done - Phase 1

```markdown
## Validation Phase 1

### Dépendances
- [ ] Aucune dépendance "internal" ou "beta" critique
- [ ] `pnpm audit` sans vulnérabilités high/critical
- [ ] `pnpm install` sans warnings

### Sécurité
- [ ] CSP headers configurés
- [ ] Rate limiting actif sur /api/chat et /api/enhancer
- [ ] Validation Zod sur tous les inputs API
- [ ] Credentials encryptés dans localStorage

### Performance
- [ ] TTI < 3 secondes
- [ ] Pyodide lazy loaded
- [ ] PGLite lazy loaded
- [ ] Bundle splits configurés

### Tests
- [ ] Tests unitaires passent (878+)
- [ ] Tests E2E passent (nouveaux)
- [ ] TypeScript sans erreurs
- [ ] ESLint sans erreurs
- [ ] Build réussi

### Documentation
- [ ] .env.example créé
- [ ] BAVINI.md mis à jour
- [ ] README.md mis à jour
```

---

*Ce document est maintenu avec le projet. Mettre à jour lors de changements architecturaux majeurs.*
