import React, { useState, useEffect, useRef } from 'react';
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

// Enhanced Text Renderer
const TextRenderer: React.FC<{ content: string, figures: FigureReference[] }> = ({ content, figures }) => {
  // Replace figure references with components
  const processText = (text: string) => {
    const figureRegex = /\[{"pageContent":"([^"]+)","metadata":({[^}]*})}\]/g;
    const parts = text.split(figureRegex);
    
    return parts.map((part, index) => {
      if (index % 3 === 0) {
        // Regular text
        return (
          <span key={index} className="leading-relaxed">
            {part}
          </span>
        );
      } else if (index % 3 === 1) {
        // Figure title - find matching figure
        const figure = figures.find(f => f.title === part);
        if (figure) {
          return <FigureReference key={index} figure={figure} />;
        }
        return null;
      }
      return null; // Skip metadata parts
    });
  };

  // Process bullet points and formatting
  const formatContent = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-2 my-4 ml-4">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-sm leading-relaxed text-foreground/90">
                {processText(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('- ')) {
        if (!inList) inList = true;
        listItems.push(trimmedLine.substring(2));
      } else if (trimmedLine.startsWith('* ')) {
        if (!inList) inList = true;
        listItems.push(trimmedLine.substring(2));
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        if (!inList) inList = true;
        listItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
      } else if (trimmedLine === '') {
        flushList();
        // Add spacing
      } else if (trimmedLine) {
        flushList();
        elements.push(
          <p key={index} className="text-sm leading-relaxed text-foreground/90 my-3">
            {processText(trimmedLine)}
          </p>
        );
      }
    });

    flushList();
    return elements;
  };

  return <div className="space-y-2">{formatContent(content)}</div>;
};

// Section Component
const SectionComponent: React.FC<{ 
  section: ParsedSection, 
  figures: FigureReference[], 
  activeSection: string,
  onSectionClick: (id: string) => void 
}> = ({ section, figures, activeSection, onSectionClick }) => {
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
        className={`${baseClasses} ${sizeClasses[level as keyof typeof sizeClasses]} ${isActive ? 'text-primary' : ''}`}
        onClick={() => onSectionClick(id)}
      >
        <Hash className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        {children}
      </Component>
    );
  };

  return (
    <div className="space-y-4">
      <HeadingComponent level={section.level} id={section.id}>
        {section.title}
      </HeadingComponent>
      
      {section.content.trim() && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
          <CardContent className="pt-4">
            <TextRenderer content={section.content} figures={figures} />
          </CardContent>
        </Card>
      )}

      {section.children.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mb-2">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="ml-2">
                {section.children.length} subsection{section.children.length !== 1 ? 's' : ''}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 ml-4">
            {section.children.map((child) => (
              <SectionComponent
                key={child.id}
                section={child}
                figures={figures}
                activeSection={activeSection}
                onSectionClick={onSectionClick}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

// Enhanced Content Renderer using shadcn/ui components
const ContentRenderer: React.FC<{ content: string }> = ({ content }) => {
  const [activeSection, setActiveSection] = useState<string>('');
  
  const { sections, figures } = parseReportContent(content);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    
    // Scroll to section with proper offset
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        const headerOffset = 120; // Account for fixed header
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150; // Offset for better UX
      
      // Find all section elements
      const sectionElements = sections.map(section => ({
        id: section.id,
        element: document.getElementById(section.id)
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
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Set initial active section
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections, activeSection]);

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
        <Card className="bg-green-50/50 border-green-200">
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

  // Handle scroll for scroll-to-top button and active section tracking
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollAreaRef.current) return;
      const scrollTop = scrollAreaRef.current.scrollTop;
      setShowScrollTop(scrollTop > 300);
      
      // Track active section within scroll area
      const scrollPosition = scrollTop + 150;
      const sectionElements = sections.map(section => ({
        id: section.id,
        element: scrollAreaRef.current?.querySelector(`#${section.id}`) as HTMLElement
      })).filter(item => item.element);

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
      }
    };

    const scrollElement = scrollAreaRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [sections, activeSection]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element && scrollAreaRef.current) {
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
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
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
            onClick={() => scrollToSection(section.id)}
            className={`w-full text-left p-2 rounded-md text-sm transition-all hover:bg-muted/50 border-l-2 ${
              activeSection === section.id 
                ? 'bg-primary/10 border-l-primary text-primary font-medium' 
                : 'border-l-transparent text-muted-foreground hover:text-foreground hover:border-l-muted'
            }`}
            style={{ paddingLeft: `${(section.level - 1) * 16 + 8}px` }}
          >
            <span className="block truncate">{section.title}</span>
          </button>
        ))}
      </div>
      
      {filteredSections.length === 0 && searchTerm && (
        <div className="text-center py-4 text-muted-foreground text-sm">
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
          <ScrollArea 
            className="h-full" 
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
                <ContentRenderer content={content} />
              )}
            </div>
          </ScrollArea>
          
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