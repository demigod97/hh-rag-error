import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Function to generate consistent IDs for headings
  const generateHeadingId = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => {
          const id = generateHeadingId(children.toString());
          return (
            <h1 
              id={id} 
              className="scroll-mt-20 text-3xl font-bold mt-8 mb-6 text-foreground border-b pb-2"
            >
              {children}
            </h1>
          );
        },
        h2: ({ children }) => {
          const id = generateHeadingId(children.toString());
          return (
            <h2 
              id={id} 
              className="scroll-mt-20 text-2xl font-semibold mt-8 mb-4 text-foreground"
            >
              {children}
            </h2>
          );
        },
        h3: ({ children }) => {
          const id = generateHeadingId(children.toString());
          return (
            <h3 
              id={id} 
              className="scroll-mt-20 text-xl font-medium mt-6 mb-3 text-foreground"
            >
              {children}
            </h3>
          );
        },
        h4: ({ children }) => {
          const id = generateHeadingId(children.toString());
          return (
            <h4 
              id={id} 
              className="scroll-mt-20 text-lg font-medium mt-4 mb-2 text-foreground"
            >
              {children}
            </h4>
          );
        },
        // Enhanced paragraph styling
        p: ({ children }) => (
          <p className="my-4 leading-7 text-foreground/90">
            {children}
          </p>
        ),
        // Enhanced list styling
        ul: ({ children }) => (
          <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">
            {children}
          </ol>
        ),
        // Enhanced blockquote styling
        blockquote: ({ children }) => (
          <blockquote className="mt-6 border-l-2 pl-6 italic text-foreground/80">
            {children}
          </blockquote>
        ),
        // Code block styling
        code: ({ node, inline, className, children, ...props }: {
          node?: any;
          inline?: boolean;
          className?: string;
          children: React.ReactNode;
        }) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <div className="my-6 rounded-lg overflow-hidden">
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                className="text-sm"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code 
              className="px-1.5 py-0.5 rounded-sm bg-muted font-mono text-sm" 
              {...props}
            >
              {children}
            </code>
          );
        },
        // Enhanced link styling
        a: ({ children, href }) => (
          <a 
            href={href} 
            className="text-primary underline underline-offset-4 hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Enhanced table styling
        table: ({ children }) => (
          <div className="my-6 w-full overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border px-4 py-2 text-left font-medium bg-muted">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border px-4 py-2">
            {children}
          </td>
        ),
        hr: () => (
          <hr className="my-8 border-muted" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer; 