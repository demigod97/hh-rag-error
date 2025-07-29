import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, MapPin } from 'lucide-react';

interface ReportLinkProps {
  title: string;
  topic: string;
  address?: string;
  status?: string;
  createdAt?: string;
  onOpenReport?: () => void;
  className?: string;
}

export const ReportLink: React.FC<ReportLinkProps> = ({
  title,
  topic,
  address,
  status = 'generated',
  createdAt,
  onOpenReport,
  className = ''
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Just now';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'generated':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className={`w-full hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">{title}</h4>
              <p className="text-sm text-muted-foreground">{topic}</p>
            </div>
          </div>
          <Badge variant={getStatusColor(status)} className="text-xs">
            {status}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          {address && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{address}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>Generated {formatDate(createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Full report available in Reports Panel →
          </p>
          <Button
            onClick={onOpenReport}
            size="sm"
            className="h-8"
            variant="outline"
          >
            <FileText className="h-3 w-3 mr-2" />
            View Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 