import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';

// content part types for multimodal messages
interface TextPart {
  type: 'text';
  text: string;
}

interface ImagePart {
  type: 'image';
  image: string;
}

type ContentPart = TextPart | ImagePart;

interface UserMessageProps {
  content: string | ContentPart[];
}

export function UserMessage({ content }: UserMessageProps) {
  // handle multimodal content (array of parts)
  if (Array.isArray(content)) {
    const imageParts = content.filter((part): part is ImagePart => part.type === 'image');
    const textParts = content.filter((part): part is TextPart => part.type === 'text');
    const textContent = textParts.map((part) => part.text).join('\n');

    return (
      <div className="min-w-0 pt-[4px]">
        {/* Display images */}
        {imageParts.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {imageParts.map((imagePart, index) => (
              <img
                key={index}
                src={imagePart.image}
                alt={`Image ${index + 1}`}
                className="max-w-[200px] max-h-[200px] object-contain rounded-lg border border-bolt-elements-borderColor"
              />
            ))}
          </div>
        )}
        {/* Display text */}
        {textContent && <Markdown limitedMarkdown>{sanitizeUserMessage(textContent)}</Markdown>}
      </div>
    );
  }

  // handle string content (text-only message)
  return (
    <div className="min-w-0 pt-[4px]">
      <Markdown limitedMarkdown>{sanitizeUserMessage(content)}</Markdown>
    </div>
  );
}

function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').trim();
}
