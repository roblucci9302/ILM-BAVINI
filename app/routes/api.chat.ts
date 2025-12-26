import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { evaluateQuality, type QualityReport } from '~/lib/.server/quality';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.chat');

/**
 * Vérifie si le contenu contient du code généré (boltAction avec des fichiers)
 */
function containsGeneratedCode(content: string): boolean {
  return content.includes('<boltAction') && content.includes('type="file"');
}

/**
 * Génère le prompt d'amélioration basé sur le rapport de qualité
 */
function generateQualityFeedback(report: QualityReport): string {
  if (report.score.action === 'approve') {
    return '';
  }

  const lines: string[] = [
    '',
    '---',
    '',
    `📊 **Score Qualité BAVINI** : ${report.score.overall}/100`,
    '',
  ];

  // Ajouter le détail des scores par catégorie si score < 80
  if (report.score.overall < 80) {
    lines.push('📈 **Détail par catégorie** :');
    lines.push(`- TypeScript : ${report.score.categories.typescript}/100`);
    lines.push(`- Tests : ${report.score.categories.testing}/100`);
    lines.push(`- Sécurité : ${report.score.categories.security}/100`);
    lines.push(`- Maintenabilité : ${report.score.categories.maintainability}/100`);
    lines.push('');
  }

  if (report.suggestions.length > 0) {
    lines.push('💡 **Améliorations détectées** :');
    for (const suggestion of report.suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }

  // Message selon l'action recommandée
  if (report.score.action === 'refactor' || report.score.action === 'improve') {
    lines.push('⚠️ *Ces améliorations seront appliquées automatiquement...*');
  } else if (report.score.action === 'suggest') {
    lines.push('💬 *Suggestions optionnelles - le code fonctionne mais pourrait être amélioré.*');
  }

  return lines.join('\n');
}

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages } = await request.json<{ messages: Messages }>();

  const stream = new SwitchableStream();

  // Compteur pour éviter les boucles infinies d'amélioration
  let improvementAttempts = 0;
  const MAX_IMPROVEMENT_ATTEMPTS = 1;

  try {
    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        // Évaluer la qualité si du code a été généré
        if (containsGeneratedCode(content) && improvementAttempts < MAX_IMPROVEMENT_ATTEMPTS) {
          const qualityReport = evaluateQuality(content);

          logger.info(`Quality Score: ${qualityReport.score.overall}/100 (${qualityReport.score.level})`);

          // Si amélioration nécessaire, déclencher un cycle de correction
          if (qualityReport.score.action === 'improve' || qualityReport.score.action === 'refactor') {
            improvementAttempts++;

            const feedback = generateQualityFeedback(qualityReport);
            const improvementPrompt = `
Le code généré a obtenu un score de qualité de ${qualityReport.score.overall}/100.

Problèmes détectés :
${qualityReport.issues.map((i) => `- [${i.severity.toUpperCase()}] ${i.message}`).join('\n')}

IMPORTANT: Améliore le code pour corriger ces problèmes. Assure-toi de :
1. Utiliser TypeScript avec des types stricts (pas de 'any')
2. Ajouter des tests Vitest pour chaque module
3. Ajouter try/catch pour les opérations async
4. Respecter la limite de 100 lignes par fichier

Régénère les fichiers corrigés.`;

            logger.info('Triggering quality improvement cycle...');

            messages.push({ role: 'assistant', content: content + feedback });
            messages.push({ role: 'user', content: improvementPrompt });

            const result = await streamText(messages, context.cloudflare.env, options);

            return stream.switchSource(result.toAIStream());
          }
        }

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
        contentType: 'text/plain; charset=utf-8',
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
