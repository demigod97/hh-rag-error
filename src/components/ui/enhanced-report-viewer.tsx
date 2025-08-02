import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  MapPin, 
  Calendar, 
  Menu,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  Share2,
  Search,
  List,
  AlertTriangle,
  Image as ImageIcon,
  ExternalLink,
  Hash
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';

// Advanced Report Content Parser and Renderer
interface ParsedSection {
  id: string;
  level: number;
  title: string;
  content: string;
  children: ParsedSection[];
  lineNumber: number;
}

interface FigureReference {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
}

const parseReportContent = (content: string): { sections: ParsedSection[], figures: FigureReference[] } => {
  try {
    // Parse JSON if needed
    let textContent = content;
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      const parsed = JSON.parse(content);
      textContent = parsed.response || content;
    }

    const lines = textContent.split('\n');
    const sections: ParsedSection[] = [];
    const figures: FigureReference[] = [];
    let currentSection: ParsedSection | null = null;
    let sectionStack: ParsedSection[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Parse headings
      const h1Match = trimmedLine.match(/^# (.+)$/);
      const h2Match = trimmedLine.match(/^## (.+)$/);
      const h3Match = trimmedLine.match(/^### (.+)$/);
      const h4Match = trimmedLine.match(/^#### (.+)$/);

      if (h1Match || h2Match || h3Match || h4Match) {
        const level = h1Match ? 1 : h2Match ? 2 : h3Match ? 3 : 4;
        const title = (h1Match || h2Match || h3Match || h4Match)?.[1] || '';
        
        const newSection: ParsedSection = {
          id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          level,
          title,
          content: '',
          children: [],
          lineNumber: index
        };

        // Handle section hierarchy
        if (level === 1) {
          sections.push(newSection);
          sectionStack = [newSection];
        } else {
          // Find the appropriate parent
          while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
            sectionStack.pop();
          }
          
          if (sectionStack.length > 0) {
            sectionStack[sectionStack.length - 1].children.push(newSection);
          } else {
            sections.push(newSection);
          }
          sectionStack.push(newSection);
        }
        
        currentSection = newSection;
      } else if (currentSection && trimmedLine) {
        // Add content to current section
        currentSection.content += line + '\n';
      }
    });

    // Extract figure references
    const figureRegex = /\[{"pageContent":"([^"]+)","metadata":({[^}]*})}\]/g;
    let match;
    let figureIndex = 1;
    
    while ((match = figureRegex.exec(textContent)) !== null) {
      try {
        figures.push({
          id: `figure-${figureIndex}`,
          title: match[1],
          metadata: JSON.parse(match[2])
        });
        figureIndex++;
      } catch (e) {
        console.warn('Failed to parse figure metadata:', e);
      }
    }

    return { sections, figures };
  } catch (error) {
    console.error('Error parsing report content:', error);
    return { sections: [], figures: [] };
  }
};

// Figure Reference Component
const FigureReference: React.FC<{ figure: FigureReference }> = ({ figure }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button 
        variant="outline" 
        size="sm"
        className="mx-1 h-auto py-1 px-2 text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
      >
        <ImageIcon className="h-3 w-3 mr-1" />
        {figure.title.substring(0, 20)}...
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-80">
      <div className="space-y-3">
        <div className="font-medium text-sm">{figure.title}</div>
        <div className="text-xs text-muted-foreground">
          Figure reference from planning documentation
        </div>
        <Separator />
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => {
            console.log('View figure:', figure);
            // Implement figure viewer modal here
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Full Image
        </Button>
      </div>
    </PopoverContent>
  </Popover>
);

// Enhanced Markdown Text Renderer
const TextRenderer: React.FC<{ content: string, figures: FigureReference[] }> = ({ content, figures }) => {
  // First, replace figure references with placeholders that we can process later
  const processedContent = content.replace(
    /\[{"pageContent":"([^"]+)","metadata":({[^}]*})}\]/g,
    (match, title, metadata) => {
      const figure = figures.find(f => f.title === title);
      return figure ? `[FIGURE:${figure.id}]` : match;
    }
  );

  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert')}>
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
          // Custom heading styling - these will be used by the section components
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
          // Custom paragraph styling with figure reference handling
          p: ({ children, ...props }) => {
            // Check if this paragraph contains figure references
            const childrenString = React.Children.toArray(children).join('');
            if (typeof childrenString === 'string' && childrenString.includes('[FIGURE:')) {
              // Process figure references
              const parts = childrenString.split(/(\[FIGURE:[^\]]+\])/g);
              const processedChildren = parts.map((part, index) => {
                const figureMatch = part.match(/\[FIGURE:([^\]]+)\]/);
                if (figureMatch) {
                  const figure = figures.find(f => f.id === figureMatch[1]);
                  return figure ? <FigureReference key={index} figure={figure} /> : part;
                }
                return <span key={index}>{part}</span>;
              });
              
              return (
                <p className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
                  {processedChildren}
                </p>
              );
            }
            
            return (
              <p className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
                {children}
              </p>
            );
          },
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
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

// Section Component with proper scroll anchoring
const SectionComponent: React.FC<{ 
  section: ParsedSection, 
  figures: FigureReference[], 
  activeSection: string,
  onSectionClick: (id: string) => void,
  scrollAreaRef?: React.RefObject<HTMLDivElement>
}> = ({ section, figures, activeSection, onSectionClick, scrollAreaRef }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isActive = activeSection === section.id;

  const HeadingComponent = ({ level, children, id }: { level: number, children: React.ReactNode, id: string }) => {
    const baseClasses = "scroll-mt-20 flex items-center gap-2 group cursor-pointer hover:text-primary transition-colors";
    const sizeClasses = {
      1: "text-2xl font-bold mt-8 mb-6 pb-3 border-b",
      2: "text-xl font-semibold mt-6 mb-4",
      3: "text-lg font-medium mt-5 mb-3", 
      4: "text-base font-medium mt-4 mb-2"
    };

    const Component = `h${level}` as keyof JSX.IntrinsicElements;
    
    return (
      <Component 
        id={id}
        className={`${baseClasses} ${sizeClasses[level as keyof typeof sizeClasses]} ${isActive ? 'text-primary bg-primary/5 px-2 py-1 rounded' : ''}`}
        onClick={() => onSectionClick(id)}
        data-section-id={id} // Add data attribute for scroll tracking
      >
        <Hash className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        {children}
      </Component>
    );
  };

  return (
    <div className="space-y-4" data-section={section.id}>
      <HeadingComponent level={section.level} id={section.id}>
        {section.title}
      </HeadingComponent>
      
      {section.content.trim() && (
        <div className="border-l-4 border-l-primary/30 pl-6 py-4 bg-muted/20 rounded-r-md">
          <TextRenderer content={section.content} figures={figures} />
        </div>
      )}

      {section.children.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mb-2 text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="ml-2">
                {section.children.length} subsection{section.children.length !== 1 ? 's' : ''}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 ml-4 border-l border-muted pl-4">
            {section.children.map((child) => (
              <SectionComponent
                key={child.id}
                section={child}
                figures={figures}
                activeSection={activeSection}
                onSectionClick={onSectionClick}
                scrollAreaRef={scrollAreaRef}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

// Enhanced Content Renderer using shadcn/ui components
const ContentRenderer: React.FC<{ 
  content: string, 
  scrollAreaRef?: React.RefObject<HTMLDivElement>,
  onActiveSection?: (sectionId: string) => void 
}> = ({ content, scrollAreaRef, onActiveSection }) => {
  const [activeSection, setActiveSection] = useState<string>('');
  
  const { sections, figures } = parseReportContent(content);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    onActiveSection?.(sectionId);
    
    // Scroll to section within the scroll area
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element && scrollAreaRef?.current) {
        const scrollArea = scrollAreaRef.current;
        const elementTop = element.offsetTop;
        const offset = 120; // Account for header
        
        scrollArea.scrollTo({
          top: elementTop - offset,
          behavior: 'smooth'
        });
        
        // Add visual feedback
        element.style.backgroundColor = 'rgba(var(--primary), 0.1)';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    }, 100);
  };

  // Track active section on scroll within the scroll area
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollAreaRef?.current) return;
      
      const scrollTop = scrollAreaRef.current.scrollTop;
      const scrollPosition = scrollTop + 150; // Offset for better UX
      
      // Find all section elements within the scroll area
      const sectionElements = sections.map(section => ({
        id: section.id,
        element: scrollAreaRef.current?.querySelector(`#${section.id}`) as HTMLElement
      })).filter(item => item.element);

      // Find the currently visible section
      let currentSection = '';
      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i].element;
        if (element && element.offsetTop <= scrollPosition) {
          currentSection = sectionElements[i].id;
          break;
        }
      }
      
      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
        onActiveSection?.(currentSection);
      }
    };

    const scrollElement = scrollAreaRef?.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      handleScroll(); // Set initial active section
      
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [sections, activeSection, scrollAreaRef, onActiveSection]);

  if (sections.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to parse report content. Please check the format and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {figures.length > 0 && (
        <Card className="bg-green-50/50 border-green-200 dark:bg-green-950/50 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Document Figures ({figures.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {figures.map((figure) => (
                <FigureReference key={figure.id} figure={figure} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <SectionComponent
            key={section.id}
            section={section}
            figures={figures}
            activeSection={activeSection}
            onSectionClick={handleSectionClick}
            scrollAreaRef={scrollAreaRef}
          />
        ))}
      </div>
    </div>
  );
};

interface ReportSection {
  id: string;
  title: string;
  level: number;
  lineNumber: number;
  content?: string;
}

interface ReportViewerProps {
  title: string;
  topic: string;
  address?: string;
  content: string;
  metadata?: {
    created_at?: string;
    file_size?: number;
    [key: string]: unknown;
  };
  onDownload?: () => void;
  onPrint?: () => void;
  onShare?: () => void;
}

export const EnhancedReportViewer: React.FC<ReportViewerProps> = ({
  title,
  topic,
  address,
  content,
  metadata,
  onDownload,
  onPrint,
  onShare
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Parse sections for TOC
  const { sections: parsedSections } = parseReportContent(content);
  
  // Flatten sections for TOC
  const flattenSections = (sections: ParsedSection[]): ReportSection[] => {
    const result: ReportSection[] = [];
    const traverse = (sectionList: ParsedSection[]) => {
      sectionList.forEach(section => {
        result.push({
          id: section.id,
          title: section.title,
          level: section.level,
          lineNumber: section.lineNumber
        });
        if (section.children.length > 0) {
          traverse(section.children);
        }
      });
    };
    traverse(sections);
    return result;
  };

  const sections = flattenSections(parsedSections);

  // Handle scroll for scroll-to-top button only (active section tracking is now handled in ContentRenderer)
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollAreaRef.current) return;
      const scrollTop = scrollAreaRef.current.scrollTop;
      setShowScrollTop(scrollTop > 300);
    };

    const scrollElement = scrollAreaRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToSection = (sectionId: string) => {
    if (!scrollAreaRef.current) return;
    
    // Find the element within the scroll area
    const element = scrollAreaRef.current.querySelector(`#${sectionId}`) as HTMLElement;
    if (element) {
      const scrollArea = scrollAreaRef.current;
      const elementTop = element.offsetTop;
      const offset = 100;
      
      scrollArea.scrollTo({
        top: elementTop - offset,
        behavior: 'smooth'
      });
      
      // Update active section
      setActiveSection(sectionId);
      
      // Add visual feedback
      element.style.backgroundColor = 'rgba(var(--primary), 0.1)';
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 2000);
    }
  };

  const scrollToTop = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Enhanced Table of Contents Component with proper linking
  const TableOfContents = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div className="space-y-3">
      {inSheet && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}
      
      <div className="space-y-1">
        {filteredSections.map((section) => (
          <button
            key={section.id}
            onClick={() => {
              scrollToSection(section.id);
              // Close mobile sheet if it's open
              if (inSheet) {
                // The sheet will close automatically due to the click outside behavior
                // but we can force it by triggering a state change if needed
              }
            }}
            className={`w-full text-left p-2 rounded-md text-sm transition-all hover:bg-muted/50 border-l-2 group ${
              activeSection === section.id 
                ? 'bg-primary/10 border-l-primary text-primary font-medium shadow-sm' 
                : 'border-l-transparent text-muted-foreground hover:text-foreground hover:border-l-muted hover:bg-accent'
            }`}
            style={{ paddingLeft: `${(section.level - 1) * 16 + 8}px` }}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1 h-1 rounded-full transition-colors ${
                activeSection === section.id ? 'bg-primary' : 'bg-muted-foreground/40 group-hover:bg-foreground'
              }`} />
              <span className="block truncate font-medium">{section.title}</span>
            </div>
            {activeSection === section.id && (
              <div className="text-xs text-primary/70 mt-1">Currently viewing</div>
            )}
          </button>
        ))}
      </div>
      
      {filteredSections.length === 0 && searchTerm && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No sections found matching "{searchTerm}"
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop Sidebar - Table of Contents */}
      <div className="hidden lg:block w-80 border-r bg-muted/20 overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
              <List className="h-4 w-4" />
              Table of Contents
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <TableOfContents />
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - same as before */}
        <div className="border-b bg-background p-6 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground mb-2 line-clamp-2">
                {title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>{topic}</span>
                </div>
                
                {address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate max-w-[200px]">{address}</span>
                  </div>
                )}
                
                {metadata?.created_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(metadata.created_at).toLocaleDateString()}</span>
                  </div>
                )}
                
                {metadata?.file_size && (
                  <Badge variant="outline">
                    {formatFileSize(metadata.file_size)}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              {/* Mobile TOC */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Table of Contents</SheetTitle>
                    <SheetDescription>
                      Navigate through the report sections
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <ScrollArea className="h-[calc(100vh-8rem)]">
                      <TableOfContents inSheet />
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Action Buttons */}
              {onDownload && (
                <Button variant="outline" size="sm" onClick={onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              
              {onPrint && (
                <Button variant="outline" size="sm" onClick={onPrint}>
                  <Printer className="h-4 w-4" />
                </Button>
              )}
              
              {onShare && (
                <Button variant="outline" size="sm" onClick={onShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-hidden relative">
          <div 
            className="h-full overflow-auto" 
            ref={scrollAreaRef}
            style={{ height: 'calc(100vh - 200px)' }}
          >
            <div className="max-w-4xl mx-auto p-8" ref={contentRef}>
              {!content ? (
                <Alert>
                  <AlertDescription>
                    Report content is not available or still being generated.
                  </AlertDescription>
                </Alert>
              ) : (
                <ContentRenderer 
                  content={content} 
                  scrollAreaRef={scrollAreaRef}
                  onActiveSection={setActiveSection}
                />
              )}
            </div>
          </div>
          
          {/* Scroll to Top Button */}
          {showScrollTop && (
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToTop}
              className="fixed bottom-6 right-6 z-10 rounded-full shadow-lg"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedReportViewer; 