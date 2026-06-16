import { Streamdown } from 'streamdown';
import type { ReactNode } from 'react';

interface MarkdownRendererProps {
  content: string;
  isAnimating?: boolean;
  className?: string;
}

export function MarkdownRenderer({ content, isAnimating, className }: MarkdownRendererProps): ReactNode {
  return (
    <Streamdown
      className={className}
      isAnimating={isAnimating}
    >
      {content}
    </Streamdown>
  );
}
