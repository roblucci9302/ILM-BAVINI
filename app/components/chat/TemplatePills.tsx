import { useState } from 'react';
import { getMainTemplates, getAdditionalTemplates, type ProjectTemplate } from '~/lib/templates';
import { classNames } from '~/utils/classNames';

interface TemplatePillsProps {
  onSelectTemplate: (prompt: string) => void;
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

      <div className="flex flex-wrap justify-center gap-2">
        {mainTemplates.map((template) => (
          <TemplatePill key={template.id} template={template} onClick={() => handleTemplateClick(template)} />
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
            <TemplatePill key={template.id} template={template} onClick={() => handleTemplateClick(template)} />
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

interface TemplatePillProps {
  template: ProjectTemplate;
  onClick: () => void;
}

function TemplatePill({ template, onClick }: TemplatePillProps) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
        'border flex items-center gap-2',
        'hover:scale-105 hover:shadow-md active:scale-95',
        template.color,
      )}
      title={template.description}
    >
      <span className="text-base">{template.icon}</span>
      <span className="text-bolt-elements-textPrimary">{template.name}</span>
    </button>
  );
}
