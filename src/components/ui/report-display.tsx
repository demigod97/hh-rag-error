import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EnhancedMarkdownRenderer } from '@/components/ui/enhanced-markdown-renderer';
import { getReportContent } from '@/lib/api';
import { 
  FileText, 
  MapPin, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  Download,
  Eye,
  Share2,
  Printer,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReportData {
  action: string;
  topic: string;
  address?: string;
  markdown?: string;
  metadata?: {
    reportId?: string;
    [key: string]: unknown;
  };
  timestamp?: string;
  id?: string;
  report_id?: string;
}

interface ReportDisplayProps {
  data: ReportData;
  className?: string;
}

export const ReportDisplay: React.FC<ReportDisplayProps> = ({ data, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reportContent, setReportContent] = useState(data.markdown || '');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Extract sections from markdown for better navigation
  const extractSections = (markdown: string) => {
    if (!markdown) return [];
    
    const sections = [];
    const lines = markdown.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    for (const line of lines) {
      const h1Match = line.match(/^# (.+)$/);
      const h2Match = line.match(/^## (.+)$/);
      
      if (h1Match) {
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: currentContent.join('\n').trim()
          });
        }
        currentSection = {
          id: h1Match[1].toLowerCase().replace(/\s+/g, '-'),
          title: h1Match[1],
          level: 1,
          subsections: []
        };
        currentContent = [line];
      } else if (h2Match && currentSection) {
        const subsection = {
          id: h2Match[1].toLowerCase().replace(/\s+/g, '-'),
          title: h2Match[1],
          level: 2
        };
        currentSection.subsections.push(subsection);
        currentContent.push(line);
      } else {
        currentContent.push(line);
      }
    }
    
    if (currentSection) {
      sections.push({
        ...currentSection,
        content: currentContent.join('\n').trim()
      });
    }
    
    return sections;
  };

  // Effect to fetch report content if needed
  useEffect(() => {
    const fetchContentIfNeeded = async () => {
      // If we already have content, no need to fetch
      if (reportContent && reportContent.trim()) {
        console.log('📊 Report already has content, using directly');
        return;
      }

      // Check if we have a report ID to fetch from database
      const reportId = data.metadata?.reportId || data.id || data.report_id;
      if (!reportId) {
        console.warn('⚠️ No markdown content and no report ID to fetch from database');
        setContentError('No report content or ID available');
        return;
      }

      console.log('🔄 Fetching report content from database for ID:', reportId);
      setIsLoadingContent(true);
      setContentError(null);

      try {
        const content = await getReportContent(reportId);
        console.log('✅ Successfully fetched report content:', content.length, 'characters');
        setReportContent(content);
      } catch (err) {
        console.error('❌ Failed to fetch report content:', err);
        setContentError(`Failed to load report: ${err.message}`);
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchContentIfNeeded();
  }, [data, reportContent]);

  const sections = reportContent ? extractSections(reportContent) : [];

  const handleDownload = () => {
    if (!reportContent) return;
    
    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.topic.replace(/\s+/g, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share && reportContent) {
      try {
        await navigator.share({
          title: data.topic,
          text: `Planning Report: ${data.topic}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle escape key for fullscreen exit
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen]);

  return (
    <Card className={`report-display w-full max-w-none ${className} ${
      isFullscreen 
        ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)] max-h-none shadow-2xl' 
        : ''
    }`}>
      <CardHeader className="pb-4">
        {isFullscreen && (
          <div className="mb-2 text-center">
            <Badge variant="outline" className="text-xs">
              Fullscreen Mode - Press ESC to exit
            </Badge>
          </div>
        )}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold leading-tight mb-2">
                {data.topic}
              </CardTitle>
              
              {data.address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4" />
                  <span>{data.address}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Planning Report
                </Badge>
                
                {data.timestamp && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(data.timestamp).toLocaleDateString()}
                  </Badge>
                )}
                
                {sections.length > 0 && (
                  <Badge variant="outline">
                    {sections.length} Section{sections.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0"
              title={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="h-8 w-8 p-0"
              title="More actions"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
              title={isExpanded ? "Collapse report" : "Expand report"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            
            {navigator.share && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoadingContent ? (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <AlertDescription>
                  Loading report content...
                </AlertDescription>
              </Alert>
            ) : contentError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {contentError}
                </AlertDescription>
              </Alert>
            ) : !reportContent ? (
              <Alert>
                <AlertDescription>
                  Report content is not available or still being generated.
                </AlertDescription>
              </Alert>
            ) : sections.length > 0 ? (
              <div className="space-y-6">
                {/* Table of Contents for longer reports */}
                {sections.length > 3 && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Contents</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1">
                        {sections.map((section, index) => (
                          <div key={section.id}>
                            <a
                              href={`#${section.id}`}
                              className="text-sm text-muted-foreground hover:text-foreground transition-colors block py-1"
                            >
                              {index + 1}. {section.title}
                            </a>
                            {section.subsections.length > 0 && (
                              <div className="ml-4 space-y-1">
                                {section.subsections.map((subsection, subIndex) => (
                                  <a
                                    key={subsection.id}
                                    href={`#${subsection.id}`}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors block py-0.5"
                                  >
                                    {index + 1}.{subIndex + 1} {subsection.title}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Separator />
                
                {/* Report Content */}
                <ScrollArea className={`h-auto pr-4 ${
                  isFullscreen 
                    ? 'max-h-[calc(100vh-20rem)]' 
                    : 'max-h-[70vh]'
                }`}>
                  <div className="prose prose-sm max-w-none">
                    <EnhancedMarkdownRenderer content={reportContent} />
                  </div>
                </ScrollArea>
              </div>
                         ) : (
               <ScrollArea className={`h-auto pr-4 ${
                 isFullscreen 
                   ? 'max-h-[calc(100vh-20rem)]' 
                   : 'max-h-[70vh]'
               }`}>
                 <div className="prose prose-sm max-w-none">
                   <EnhancedMarkdownRenderer content={reportContent} />
                 </div>
               </ScrollArea>
             )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ReportDisplay; 