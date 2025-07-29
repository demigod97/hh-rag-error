import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
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
  Hash,
  Maximize2,
  Minimize2
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
    const sectionStack: ParsedSection[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Parse headings
      const h1Match = trimmedLine.match(/^# (.+)$/);
      const h2Match = trimmedLine.match(/^## (.+)$/);
      const h3Match = trimmedLine.match(/^### (.+)$/);
      const h4Match = trimmedLine.match(/^#### (.+)$/);
      
      if (h1Match || h2Match || h3Match || h4Match) {
        let level: number;
        let title: string;
        
        if (h1Match) {
          level = 1;
          title = h1Match[1];
        } else if (h2Match) {
          level = 2;
          title = h2Match[1];
        } else if (h3Match) {
          level = 3;
          title = h3Match[1];
        } else {
          level = 4;
          title = h4Match![1];
        }

        const newSection: ParsedSection = {
          id: title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          level,
          title,
          content: '',
          children: [],
          lineNumber: index + 1
        };

        // Find the appropriate parent section
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }

        if (sectionStack.length === 0) {
          sections.push(newSection);
        } else {
          sectionStack[sectionStack.length - 1].children.push(newSection);
        }

        sectionStack.push(newSection);
        currentSection = newSection;
      } else if (currentSection) {
        // Add content to current section
        currentSection.content += line + '\n';
      }

      // Parse figure references
      const figureMatches = line.matchAll(/\[{"pageContent":"([^"]+)","metadata":({[^}]*})}\]/g);
      for (const match of figureMatches) {
        try {
          const metadata = JSON.parse(match[2]);
          figures.push({
            id: `figure-${figures.length + 1}`,
            title: match[1],
            metadata
          });
        } catch (e) {
          console.warn('Failed to parse figure metadata:', e);
        }
      }
    });

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
        className="h-8 gap-2 text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
      >
        <ImageIcon className="h-3 w-3" />
        {figure.title.substring(0, 30)}...
        <ExternalLink className="h-3 w-3" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-80">
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Document Reference</h4>
        <p className="text-sm text-muted-foreground">{figure.title}</p>
        {Object.keys(figure.metadata).length > 0 && (
          <div className="text-xs">
            <div className="font-medium mb-1">Metadata:</div>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto">
              {JSON.stringify(figure.metadata, null, 2)}
            </pre>
          </div>
        )}
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

  const formatContent = (text: string) => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushList = () => {
      if (listItems.length > 0) {
        result.push(
          <ul key={`list-${result.length}`} className="list-disc list-inside space-y-1 my-3 ml-4">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed">
                {processText(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) inList = true;
        listItems.push(trimmed.substring(2));
      } else if (trimmed.match(/^\d+\.\s/)) {
        flushList();
        const match = trimmed.match(/^\d+\.\s(.+)$/);
        if (match) {
          result.push(
            <div key={`numbered-${i}`} className="flex gap-2 my-2">
              <span className="font-medium text-primary">{trimmed.split('.')[0]}.</span>
              <span className="flex-1 text-sm leading-relaxed">{processText(match[1])}</span>
            </div>
          );
        }
      } else {
        flushList();
        if (trimmed) {
          result.push(
            <p key={`text-${i}`} className="text-sm leading-relaxed my-2">
              {processText(line)}
            </p>
          );
        }
      }
    });
    
    flushList();
    return result;
  };

  return <div className="space-y-2">{formatContent(content)}</div>;
};

// Section Component with enhanced typography
const SectionComponent: React.FC<{ 
  section: ParsedSection, 
  figures: FigureReference[], 
  activeSection: string,
  onSectionClick: (id: string) => void 
}> = ({ section, figures, activeSection, onSectionClick }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const HeadingComponent = ({ level, children, id }: { level: number, children: React.ReactNode, id: string }) => {
    const isActive = activeSection === id;
    const baseClasses = `scroll-mt-20 flex items-center gap-2 cursor-pointer group transition-colors ${
      isActive ? 'text-primary' : 'text-foreground hover:text-primary'
    }`;
    
    const handleClick = () => {
      onSectionClick(id);
      setIsCollapsed(!isCollapsed);
    };

    switch (level) {
      case 1:
        return (
          <h1 id={id} className={`text-2xl font-bold mb-4 ${baseClasses}`} onClick={handleClick}>
            <Hash className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {children}
            <Button variant="ghost" size="sm" className="ml-auto">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </h1>
        );
      case 2:
        return (
          <h2 id={id} className={`text-xl font-semibold mb-3 ${baseClasses}`} onClick={handleClick}>
            <Hash className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            {children}
            <Button variant="ghost" size="sm" className="ml-auto">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </h2>
        );
      case 3:
        return (
          <h3 id={id} className={`text-lg font-medium mb-2 ${baseClasses}`} onClick={handleClick}>
            <Hash className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            {children}
            <Button variant="ghost" size="sm" className="ml-auto">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </h3>
        );
      default:
        return (
          <h4 id={id} className={`text-base font-medium mb-2 ${baseClasses}`} onClick={handleClick}>
            <Hash className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            {children}
            <Button variant="ghost" size="sm" className="ml-auto">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </h4>
        );
    }
  };

  return (
    <div className="space-y-4">
      <HeadingComponent level={section.level} id={section.id}>
        {section.title}
      </HeadingComponent>
      
      <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
        <CollapsibleContent className="space-y-4">
          {section.content.trim() && (
            <div className="pl-4 border-l-2 border-muted">
              <TextRenderer content={section.content} figures={figures} />
            </div>
          )}
          
          {section.children.map((child) => (
            <div key={child.id} className="ml-4">
              <SectionComponent
                section={child}
                figures={figures}
                activeSection={activeSection}
                onSectionClick={onSectionClick}
              />
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
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

interface ChatReportViewerProps {
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

export const ChatReportViewer: React.FC<ChatReportViewerProps> = ({
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
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter sections based on search
  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="w-full max-w-none">
      {/* Compact Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold leading-tight mb-1">
                {title}
              </CardTitle>
              
              {address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <MapPin className="h-3 w-3" />
                  <span className="text-xs">{address}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Planning Report
                </Badge>
                
                {metadata?.created_at && (
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(metadata.created_at).toLocaleDateString()}
                  </Badge>
                )}
                
                {sections.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {sections.length} Section{sections.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-4">
            {/* Table of Contents Drawer */}
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Table of Contents">
                  <List className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Table of Contents</DrawerTitle>
                  <DrawerDescription>
                    Navigate through the report sections
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-4">
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search sections..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* TOC List */}
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1">
                      {filteredSections.map((section, index) => (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm ${
                            section.level === 1 ? 'font-medium' : 
                            section.level === 2 ? 'ml-4 font-normal' : 
                            section.level === 3 ? 'ml-8 text-muted-foreground' : 
                            'ml-12 text-muted-foreground text-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Hash className="h-3 w-3 opacity-50" />
                            <span className="truncate">{section.title}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {section.lineNumber}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Action Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
              title={isExpanded ? "Collapse report" : "Expand report"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
              title={isExpanded ? "Collapse report" : "Expand report"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Action Bar - Only show when expanded */}
        {isExpanded && (
          <div className="flex items-center gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            
            {navigator.share && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShare}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      {/* Content */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ScrollArea className="h-auto pr-4 max-h-[60vh]">
              <div className="prose prose-sm max-w-none" ref={contentRef}>
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
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}; 