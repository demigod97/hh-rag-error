import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = "" 
}) => {
  const renderMarkdown = (markdown: string): JSX.Element[] => {
    const lines = markdown.split('\n');
    const elements: JSX.Element[] = [];
    let currentList: JSX.Element[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';

    const flushList = () => {
      if (currentList.length > 0) {
        const ListComponent = listType === 'ol' ? 'ol' : 'ul';
        elements.push(
          <ListComponent key={`list-${elements.length}`} className="ml-6 mb-4 space-y-2">
            {currentList.map((item, index) => (
              <li key={index} className="text-foreground">
                {item}
              </li>
            ))}
          </ListComponent>
        );
        currentList = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Headers
      if (trimmedLine.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={index} className="text-3xl font-bold mb-4 text-foreground border-b pb-2">
            {trimmedLine.substring(2)}
          </h1>
        );
      } else if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-2xl font-semibold mb-3 text-foreground mt-6 border-b pb-2">
            {trimmedLine.substring(3)}
          </h2>
        );
      } else if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-xl font-medium mb-2 text-foreground mt-4">
            {trimmedLine.substring(4)}
          </h3>
        );
      } else if (trimmedLine.startsWith('#### ')) {
        flushList();
        elements.push(
          <h4 key={index} className="text-lg font-medium mb-2 text-foreground mt-3">
            {trimmedLine.substring(5)}
          </h4>
        );
      }
      // Lists
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (!inList) {
          listType = 'ul';
          inList = true;
        }
        currentList.push(
          <span key={index} className="text-foreground">
            {trimmedLine.substring(2)}
          </span>
        );
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        if (!inList) {
          listType = 'ol';
          inList = true;
        }
        currentList.push(
          <span key={index} className="text-foreground">
            {trimmedLine.replace(/^\d+\.\s/, '')}
          </span>
        );
      }
      // Code blocks
      else if (trimmedLine.startsWith('```')) {
        flushList();
        // Simple code block handling
        elements.push(
          <Card key={index} className="my-4">
            <CardContent className="p-4 bg-muted">
              <pre className="text-sm font-mono text-foreground overflow-x-auto">
                <code>{trimmedLine.substring(3)}</code>
              </pre>
            </CardContent>
          </Card>
        );
      }
      // Inline code
      else if (trimmedLine.includes('`')) {
        flushList();
        const processedLine = trimmedLine.replace(/`([^`]+)`/g, 
          '<code class="bg-muted px-2 py-1 rounded text-sm font-mono">$1</code>'
        );
        elements.push(
          <p key={index} className="mb-4 text-foreground" 
             dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }
      // Separators
      else if (trimmedLine === '---' || trimmedLine === '***') {
        flushList();
        elements.push(<Separator key={index} className="my-6" />);
      }
      // Empty lines
      else if (trimmedLine === '') {
        flushList();
        if (elements.length > 0 && elements[elements.length - 1].type !== 'hr') {
          elements.push(<div key={index} className="mb-4" />);
        }
      }
      // Regular paragraphs
      else {
        flushList();
        // Process bold and italic
        let processedLine = trimmedLine
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
        
        elements.push(
          <p key={index} className="mb-4 text-foreground leading-relaxed" 
             dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }
    });

    flushList();
    return elements;
  };

  return (
    <div className={`prose prose-lg max-w-none ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
}; 