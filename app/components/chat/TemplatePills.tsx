import { useState } from 'react';
import { getMainTemplates, getAdditionalTemplates, type ProjectTemplate } from '~/lib/templates';
import { classNames } from '~/utils/classNames';
import styles from './TemplatePills.module.scss';

interface TemplatePillsProps {
  onSelectTemplate: (prompt: string) => void;
}

/**
 * Map template ID to CSS variant class
 */
function getVariantClass(templateId: string): string {
  const variantMap: Record<string, string> = {
    'react-vite-ts': styles.react,
    'node-ts': styles.node,
    'next-ts': styles.next,
    'astro-ts': styles.astro,
    'express-ts': styles.express,
    'supabase-fullstack': styles.supabase,
  };
  return variantMap[templateId] || styles.react;
}

/**
 * Composant de sélection rapide de templates
 * Affiche des "pills" cliquables pour démarrer avec un template
 */
export function TemplatePills({ onSelectTemplate }: TemplatePillsProps) {
  const [showMore, setShowMore] = useState(false);

  const mainTemplates = getMainTemplates();
  const additionalTemplates = getAdditionalTemplates();

  const handleTemplateClick = (template: ProjectTemplate) => {
    onSelectTemplate(template.prompt);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <p className="text-center text-sm text-bolt-elements-textSecondary mb-3">Démarrer avec :</p>

      <div className="flex flex-wrap justify-center gap-3">
        {mainTemplates.map((template) => (
          <AnimatedTemplatePill
            key={template.id}
            template={template}
            onClick={() => handleTemplateClick(template)}
          />
        ))}

        {!showMore && additionalTemplates.length > 0 && (
          <button
            onClick={() => setShowMore(true)}
            className={classNames(
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
              'border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorHover',
              'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
            )}
          >
            + Plus
          </button>
        )}

        {showMore &&
          additionalTemplates.map((template) => (
            <AnimatedTemplatePill
              key={template.id}
              template={template}
              onClick={() => handleTemplateClick(template)}
            />
          ))}

        {showMore && (
          <button
            onClick={() => setShowMore(false)}
            className={classNames(
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
            )}
          >
            Moins
          </button>
        )}
      </div>
    </div>
  );
}

interface AnimatedTemplatePillProps {
  template: ProjectTemplate;
  onClick: () => void;
}

/**
 * Animated template pill with Uiverse-style effects
 */
function AnimatedTemplatePill({ template, onClick }: AnimatedTemplatePillProps) {
  const variantClass = getVariantClass(template.id);

  return (
    <button
      onClick={onClick}
      className={classNames(styles.templatePill, variantClass)}
      title={template.description}
    >
      <div className={styles.wrapper}>
        {/* Animated circles */}
        <div className={classNames(styles.circle, styles.circle1)} />
        <div className={classNames(styles.circle, styles.circle2)} />
        <div className={classNames(styles.circle, styles.circle3)} />
        <div className={classNames(styles.circle, styles.circle4)} />
        <div className={classNames(styles.circle, styles.circle5)} />
        <div className={classNames(styles.circle, styles.circle6)} />
        <div className={classNames(styles.circle, styles.circle7)} />
        <div className={classNames(styles.circle, styles.circle8)} />
        <div className={classNames(styles.circle, styles.circle9)} />
        <div className={classNames(styles.circle, styles.circle10)} />
        <div className={classNames(styles.circle, styles.circle11)} />
        <div className={classNames(styles.circle, styles.circle12)} />

        {/* Content */}
        <span className={styles.icon}>{template.icon}</span>
        <span className={styles.label}>{template.name}</span>
      </div>
    </button>
  );
}
