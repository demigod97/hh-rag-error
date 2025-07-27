import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { 
  FileText, 
  MapPin, 
  Calendar, 
  Menu,
  ChevronUp,
  Download,
  Printer,
  Share2,
  Search,
  List,
  AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

// Enhanced Content Renderer with fallback handling
const ContentRenderer: React.FC<{ content: string }> = ({ content }) => {
  try {
    // Check if content looks like raw JSON that wasn't processed
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.response || parsed.content || parsed.markdown) {
          return (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Content appears to be in JSON format and may not have been processed correctly. 
                Please refresh to reload the content.
              </AlertDescription>
            </Alert>
          );
        }
      } catch {
        // Not JSON, continue with normal rendering
      }
    }
    
    // Use the MarkdownRenderer for all content
    return <MarkdownRenderer content={content} />;
  } catch (error) {
    console.error('Error rendering content:', error);
    
    // Fallback to plain text display
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            There was an issue rendering the content. Displaying as plain text.
          </AlertDescription>
        </Alert>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed p-4 bg-muted rounded-lg">
          {content}
        </pre>
      </div>
    );
  }
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
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Extract sections from markdown content
  useEffect(() => {
    if (!content) return;
    
    const lines = content.split('\n');
    const extractedSections: ReportSection[] = [];
    
    lines.forEach((line, index) => {
      const h1Match = line.match(/^# (.+)$/);
      const h2Match = line.match(/^## (.+)$/);
      const h3Match = line.match(/^### (.+)$/);
      const h4Match = line.match(/^#### (.+)$/);
      
      if (h1Match) {
        extractedSections.push({
          id: h1Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: h1Match[1],
          level: 1,
          lineNumber: index
        });
      } else if (h2Match) {
        extractedSections.push({
          id: h2Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: h2Match[1],
          level: 2,
          lineNumber: index
        });
      } else if (h3Match) {
        extractedSections.push({
          id: h3Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: h3Match[1],
          level: 3,
          lineNumber: index
        });
      } else if (h4Match) {
        extractedSections.push({
          id: h4Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: h4Match[1],
          level: 4,
          lineNumber: index
        });
      }
    });
    
    setSections(extractedSections);
  }, [content]);

  // Handle scroll for active section tracking and scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollAreaRef.current) return;
      
      const scrollTop = scrollAreaRef.current.scrollTop;
      setShowScrollTop(scrollTop > 300);
      
      // Find active section based on scroll position
      const headings = scrollAreaRef.current.querySelectorAll('h1, h2, h3, h4');
      let active = '';
      
      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 150) {
          active = heading.id || '';
        }
      });
      
      setActiveSection(active);
    };

    const scrollElement = scrollAreaRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Table of Contents Component
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
            className={`w-full text-left p-2 rounded-md text-sm transition-colors hover:bg-muted/50 ${
              activeSection === section.id ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'
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
    <div className="flex h-full">
      {/* Desktop Sidebar - Table of Contents */}
      <div className="hidden lg:block w-80 border-r bg-muted/20 p-4">
        <div className="space-y-4">
          <div>
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
          
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <TableOfContents />
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-background p-6">
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
        <div className="flex-1 relative">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="max-w-4xl mx-auto p-8" ref={contentRef}>
              {!content ? (
                <Alert>
                  <AlertDescription>
                    Report content is not available or still being generated.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="prose prose-lg max-w-none">
                  <ContentRenderer content={content} />
                </div>
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