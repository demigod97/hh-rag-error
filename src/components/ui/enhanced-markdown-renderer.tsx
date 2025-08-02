import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { MessageSegment, Citation } from '@/types/citation';
import CitationButton from './citation-button';
import { cn } from '@/lib/utils';

interface EnhancedMarkdownRendererProps {
  content: string | { segments: MessageSegment[]; citations: Citation[] };
  className?: string;
  onCitationClick?: (citation: Citation) => void;
  isUserMessage?: boolean;
}

const EnhancedMarkdownRenderer = ({ 
  content, 
  className = '', 
  onCitationClick, 
  isUserMessage = false 
}: EnhancedMarkdownRendererProps) => {
  // Handle enhanced content with citations
  if (typeof content === 'object' && 'segments' in content) {
    return (
      <div className={className}>
        {processMarkdownWithCitations(content.segments, content.citations, onCitationClick, isUserMessage)}
      </div>
    );
  }

  // For simple string content, use ReactMarkdown with custom components
  const markdownContent = typeof content === 'string' ? content : '';
  
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom table styling with shadcn/ui classes
          table: ({ children, ...props }) => (
            <div className="my-6 w-full overflow-y-auto">
              <table className="w-full border-collapse border border-border" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/50" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr className="border-b border-border hover:bg-muted/30" {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-border px-4 py-2 text-left font-semibold" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-border px-4 py-2" {...props}>
              {children}
            </td>
          ),
          // Custom heading styling
          h1: ({ children, ...props }) => (
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-3" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2" {...props}>
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mb-2" {...props}>
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6 className="scroll-m-20 text-base font-semibold tracking-tight mb-2" {...props}>
              {children}
            </h6>
          ),
          // Custom list styling
          ul: ({ children, ...props }) => (
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-7" {...props}>
              {children}
            </li>
          ),
          // Custom paragraph styling
          p: ({ children, ...props }) => (
            <p className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
              {children}
            </p>
          ),
          // Custom blockquote styling
          blockquote: ({ children, ...props }) => (
            <blockquote className="mt-6 border-l-2 pl-6 italic" {...props}>
              {children}
            </blockquote>
          ),
          // Custom code styling
          code: ({ children, className, ...props }) => {
            const isInline = !className || !className.includes('language-');
            if (isInline) {
              return (
                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4" {...props}>
              {children}
            </pre>
          ),
          // Custom strong/bold styling
          strong: ({ children, ...props }) => (
            <strong className="font-semibold" {...props}>
              {children}
            </strong>
          ),
          // Custom emphasis/italic styling
          em: ({ children, ...props }) => (
            <em className="italic" {...props}>
              {children}
            </em>
          ),
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

// Function to process markdown with citations inline
const processMarkdownWithCitations = (
  segments: MessageSegment[], 
  citations: Citation[], 
  onCitationClick?: (citation: Citation) => void,
  isUserMessage: boolean = false
) => {
  // For user messages, render as inline content without paragraph breaks
  if (isUserMessage) {
    return (
      <span>
        {segments.map((segment, index) => (
          <span key={index}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <span>{children}</span>, // Remove paragraph wrapper for inline
                h1: ({ children }) => <strong className="text-lg font-semibold">{children}</strong>,
                h2: ({ children }) => <strong className="text-base font-semibold">{children}</strong>,
                h3: ({ children }) => <strong className="text-sm font-semibold">{children}</strong>,
                ul: ({ children }) => <span>{children}</span>,
                ol: ({ children }) => <span>{children}</span>,
                li: ({ children }) => <span>• {children} </span>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {segment.text.replace(/\n/g, ' ')}
            </ReactMarkdown>
            {segment.citation_id && onCitationClick && (
              <CitationButton
                chunkIndex={(() => {
                  const citation = citations.find(c => c.citation_id === segment.citation_id);
                  return citation?.chunk_index || 0;
                })()}
                onClick={() => {
                  const citation = citations.find(c => c.citation_id === segment.citation_id);
                  if (citation) {
                    onCitationClick(citation);
                  }
                }}
              />
            )}
          </span>
        ))}
      </span>
    );
  }

  // For AI messages, process each segment with full markdown support
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {segments.map((segment, segmentIndex) => {
        const citation = segment.citation_id ? citations.find(c => c.citation_id === segment.citation_id) : undefined;
        
        return (
          <div key={segmentIndex} className="mb-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom table styling with shadcn/ui classes
                table: ({ children, ...props }) => (
                  <div className="my-6 w-full overflow-y-auto">
                    <table className="w-full border-collapse border border-border" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-muted/50" {...props}>
                    {children}
                  </thead>
                ),
                tbody: ({ children, ...props }) => (
                  <tbody {...props}>
                    {children}
                  </tbody>
                ),
                tr: ({ children, ...props }) => (
                  <tr className="border-b border-border hover:bg-muted/30" {...props}>
                    {children}
                  </tr>
                ),
                th: ({ children, ...props }) => (
                  <th className="border border-border px-4 py-2 text-left font-semibold" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="border border-border px-4 py-2" {...props}>
                    {children}
                  </td>
                ),
                // Custom heading styling
                h1: ({ children, ...props }) => (
                  <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mb-4" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-3" {...props}>
                    {children}
                  </h3>
                ),
                h4: ({ children, ...props }) => (
                  <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mb-2" {...props}>
                    {children}
                  </h4>
                ),
                h5: ({ children, ...props }) => (
                  <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mb-2" {...props}>
                    {children}
                  </h5>
                ),
                h6: ({ children, ...props }) => (
                  <h6 className="scroll-m-20 text-base font-semibold tracking-tight mb-2" {...props}>
                    {children}
                  </h6>
                ),
                // Custom list styling
                ul: ({ children, ...props }) => (
                  <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props}>
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="leading-7" {...props}>
                    {children}
                  </li>
                ),
                // Custom paragraph styling
                p: ({ children, ...props }) => (
                  <p className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
                    {children}
                  </p>
                ),
                // Custom blockquote styling
                blockquote: ({ children, ...props }) => (
                  <blockquote className="mt-6 border-l-2 pl-6 italic" {...props}>
                    {children}
                  </blockquote>
                ),
                // Custom code styling
                code: ({ children, className, ...props }) => {
                  const isInline = !className || !className.includes('language-');
                  if (isInline) {
                    return (
                      <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children, ...props }) => (
                  <pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4" {...props}>
                    {children}
                  </pre>
                ),
                // Custom strong/bold styling
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold" {...props}>
                    {children}
                  </strong>
                ),
                // Custom emphasis/italic styling
                em: ({ children, ...props }) => (
                  <em className="italic" {...props}>
                    {children}
                  </em>
                ),
              }}
            >
              {segment.text}
            </ReactMarkdown>
            {citation && onCitationClick && (
              <CitationButton
                chunkIndex={citation.chunk_index || 0}
                onClick={() => onCitationClick(citation)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};



export { EnhancedMarkdownRenderer };
export default EnhancedMarkdownRenderer;