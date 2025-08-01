// Citation types compatible with template but using our database schema
export interface MessageSegment {
  text: string;
  citation_id?: number;
}

export interface Citation {
  citation_id: number;
  source_id: string;
  source_title: string;
  source_type: string;
  chunk_lines_from?: number;
  chunk_lines_to?: number;
  chunk_index?: number;
  excerpt?: string;
  // Additional fields from our database
  score?: number;
  chunk_id?: number;
  document?: {
    metadata?: Record<string, unknown>;
    pageContent?: string;
  };
  address?: string;
  suburb?: string;
}

export interface EnhancedContent {
  segments: MessageSegment[];
  citations: Citation[];
}

export interface EnhancedChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string | EnhancedContent;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  feedback?: 'like' | 'dislike' | null;
  status?: 'sending' | 'delivered' | 'read' | 'failed';
}

// Helper function to transform our database chunks to template citations
export function transformChunksToCitations(
  chunks: unknown[] = [],
  sources: unknown[] = []
): Citation[] {
  const citations: Citation[] = [];

  chunks.forEach((chunk, index) => {
    const chunkData = chunk as any;
    const sourceData = sources[index] as any;
    
    const citation: Citation = {
      citation_id: index + 1,
      source_id: chunkData.chunk_id?.toString() || `chunk-${index}`,
      source_title: extractSourceTitle(chunkData, sourceData),
      source_type: extractSourceType(chunkData, sourceData),
      chunk_index: index,
      excerpt: chunkData.document?.pageContent?.substring(0, 200) + '...' || '',
      chunk_lines_from: sourceData?.chunk_lines_from,
      chunk_lines_to: sourceData?.chunk_lines_to,
      // Our database fields
      score: chunkData.score,
      chunk_id: chunkData.chunk_id,
      document: chunkData.document,
      address: sourceData?.address || chunkData.address,
      suburb: sourceData?.suburb || chunkData.suburb,
    };
    citations.push(citation);
  });

  return citations;
}

function extractSourceTitle(chunkData: any, sourceData?: any): string {
  // First try sourceData fields
  if (sourceData?.address && sourceData?.suburb) {
    return `${sourceData.address}, ${sourceData.suburb}`;
  }
  if (sourceData?.section) return sourceData.section;
  if (sourceData?.address) return sourceData.address;
  
  // Then try chunkData fields
  if (chunkData.document?.metadata?.title) return chunkData.document.metadata.title;
  if (chunkData.document?.metadata?.address) return chunkData.document.metadata.address;
  if (chunkData.address) return chunkData.address;
  
  return `Source ${chunkData.chunk_id || 'Unknown'}`;
}

function extractSourceType(chunkData: any, sourceData?: any): string {
  // First try sourceData fields
  if (sourceData?.document_type) {
    return sourceData.document_type.toLowerCase().replace(/\s+/g, '_');
  }
  
  // Then try chunkData fields
  if (chunkData.document?.metadata?.type) return chunkData.document.metadata.type;
  
  return 'text'; // Default fallback
}

// Helper function to parse content with citations into segments
export function parseContentToSegments(
  content: string,
  citations: Citation[]
): MessageSegment[] {
  if (!content || citations.length === 0) {
    return [{ text: content }];
  }

  // Combined pattern to find all citation formats
  const citationPattern = /(?:Chunk (\d+)|Chunk #(\d+)|Citation (\d+)|Source (\d+)|\[(\d+)\])/gi;
  
  const segments: MessageSegment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = citationPattern.exec(content)) !== null) {
    // Extract the citation number from whichever group matched
    const citationNumber = parseInt(match[1] || match[2] || match[3] || match[4] || match[5]);
    const citationIndex = citationNumber - 1; // Convert to 0-based index

    if (citations[citationIndex]) {
      // Add text before citation
      const beforeText = content.substring(lastIndex, match.index);
      if (beforeText.trim()) {
        segments.push({ text: beforeText });
      }

      // Add a segment that includes the citation reference
      const citationText = match[0]; // The actual citation text like "Chunk 1"
      segments.push({ 
        text: citationText,
        citation_id: citations[citationIndex].citation_id 
      });

      lastIndex = match.index + match[0].length;
    }
  }

  // Add remaining text after last citation
  const remainingText = content.substring(lastIndex);
  if (remainingText.trim()) {
    segments.push({ text: remainingText });
  }

  // If no citations were found, return the whole content as one segment
  if (segments.length === 0) {
    return [{ text: content }];
  }

  return segments;
}