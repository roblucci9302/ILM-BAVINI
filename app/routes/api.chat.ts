import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { createScopedLogger } from '~/utils/logger';
import { ChatModeAgent, type ChatMode } from '~/lib/.server/agents';
import type { AgentContext } from '~/lib/.server/agents';

const logger = createScopedLogger('api.chat');

/**
 * Extrait le dernier message utilisateur des messages
 */
function getLastUserMessage(messages: Messages): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && msg.content) {
      return msg.content;
    }
  }
  return '';
}

/**
 * Traite en mode Chat (analyse sans modification)
 * Retourne un stream compatible avec le AI SDK (useChat)
 */
async function handleChatMode(
  messages: Messages,
  context: AgentContext | undefined
): Promise<Response> {
  const agent = new ChatModeAgent();

  if (context) {
    agent.setContext(context);
  }

  const lastMessage = getLastUserMessage(messages);

  try {
    const response = await agent.process(lastMessage);

    // Créer un stream compatible avec le AI SDK format
    // Format: 0:"texte"\n pour les chunks de texte
    const encoder = new TextEncoder();
    const text = response.content || '';

    const stream = new ReadableStream({
      start(controller) {
        // Envoyer le texte au format AI SDK stream
        controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('ChatModeAgent error:', error);
    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

interface ContinuationContext {
  artifactId: string | null;
}

interface ChatRequestBody {
  messages: Messages;
  mode?: ChatMode;
  context?: AgentContext;
  continuationContext?: ContinuationContext | null;
  multiAgent?: boolean;
}

/**
 * Crée un message système de continuation à injecter
 */
function createContinuationSystemMessage(context: ContinuationContext): string {
  return `[CONTINUATION REQUISE]
L'utilisateur demande de continuer le code interrompu.
RÈGLES:
1. Utilise OBLIGATOIREMENT les balises <boltArtifact> et <boltAction>
2. ${context.artifactId ? `ID d'artifact à réutiliser: "${context.artifactId}"` : 'Crée un nouvel artifact'}
3. Ne répète pas le code déjà généré
4. Fournis les fichiers COMPLETS dans chaque <boltAction type="file">`;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const body = await request.json<ChatRequestBody>();
  const { messages, mode = 'agent', context: agentContext, continuationContext, multiAgent = false } = body;

  logger.debug(`Chat mode: ${mode}, Multi-Agent: ${multiAgent}`);

  // Si un contexte de continuation est fourni, injecter les instructions système
  // Cela permet de guider le LLM sans que l'utilisateur voie ces instructions
  if (continuationContext) {
    logger.debug('Continuation context detected, injecting system instructions');
    const continuationInstruction = createContinuationSystemMessage(continuationContext);

    // Injecter comme message système au début
    messages.unshift({
      role: 'system',
      content: continuationInstruction,
    });
  }

  // Mode Multi-Agent : ajouter des instructions pour une exécution structurée
  if (multiAgent) {
    logger.info('Multi-Agent mode enabled - structured execution');
    messages.unshift({
      role: 'system',
      content: `[MODE MULTI-AGENT ACTIVÉ]
Tu travailles en mode orchestrateur avec des sous-agents spécialisés.
Pour chaque tâche:
1. ANALYSE d'abord ce qui doit être fait
2. PLANIFIE les étapes clairement
3. EXÉCUTE chaque fichier/action de manière structurée
4. VÉRIFIE que chaque action est complète avant de passer à la suivante

Sois méthodique et explicite sur chaque action que tu entreprends.`,
    });
  }

  // Mode Chat : analyse seule, pas de modifications
  if (mode === 'chat') {
    return handleChatMode(messages, agentContext);
  }

  // Mode 'agent' - comportement existant avec streaming
  const stream = new SwitchableStream();

  try {
    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        // Continuer si max tokens atteint
        if (finishReason === 'length') {
          if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
            throw Error('Cannot continue message: Maximum segments reached');
          }

          const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

          logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: CONTINUE_PROMPT });

          const result = await streamText(messages, context.cloudflare.env, options);

          return stream.switchSource(result.toAIStream());
        }

        return stream.close();
      },
    };

    const result = await streamText(messages, context.cloudflare.env, options);

    stream.switchSource(result.toAIStream());

    return new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('Chat error:', error);

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
