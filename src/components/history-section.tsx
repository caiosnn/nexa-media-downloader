'use client';

import { useState } from 'react';
import { Download, ExternalLink, History, Loader2, Clock, FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PlatformIcon } from '@/components/platform-icon';
import { DownloadHistoryItem } from '@/types';
import { formatDistanceToNow, formatFileSize, truncateUrl } from '@/lib/utils';
import { getContentTypeName, getPlatformName } from '@/lib/platform-detector';

interface HistorySectionProps {
  history: DownloadHistoryItem[];
}

export function HistorySection({ history }: HistorySectionProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleRedownload = async (item: DownloadHistoryItem) => {
    setDownloadingId(item.id);
    // TODO: Implement re-download
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setDownloadingId(null);
  };

  return (
    <section className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl glass-card flex items-center justify-center shadow-card">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Historico
          </h2>
          <p className="text-sm text-muted-foreground">
            {history.length > 0
              ? `${history.length} ${history.length === 1 ? 'download realizado' : 'downloads realizados'}`
              : 'Seus downloads aparecerão aqui'}
          </p>
        </div>
      </div>

      {/* History Content */}
      {history.length > 0 ? (
        <div className="glass-card rounded-2xl shadow-card overflow-hidden">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-medium">Plataforma</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Tipo</TableHead>
                  <TableHead className="text-muted-foreground font-medium hidden md:table-cell">URL</TableHead>
                  <TableHead className="text-muted-foreground font-medium hidden sm:table-cell">Tamanho</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Data</TableHead>
                  <TableHead className="text-muted-foreground font-medium w-[100px]">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className={`border-border/30 hover:bg-white/[0.02] transition-colors ${
                      index === 0 ? 'bg-primary/[0.03]' : ''
                    }`}
                  >
                    {/* Platform */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-background/50 flex items-center justify-center">
                          <PlatformIcon platform={item.platform} size={18} />
                        </div>
                        <span className="text-sm font-medium text-foreground hidden sm:inline">
                          {getPlatformName(item.platform)}
                        </span>
                      </div>
                    </TableCell>

                    {/* Content Type */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="font-medium bg-primary/10 text-primary border-0 hover:bg-primary/15"
                      >
                        {getContentTypeName(item.contentType)}
                      </Badge>
                    </TableCell>

                    {/* URL */}
                    <TableCell className="hidden md:table-cell">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground hover:text-foreground font-mono flex items-center gap-2 group max-w-[200px] truncate"
                          >
                            <span className="truncate">{truncateUrl(item.url)}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="glass shadow-dropdown max-w-md">
                          <p className="font-mono text-xs break-all">{item.url}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* File Size */}
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground tabular-nums font-medium">
                        {formatFileSize(item.fileSize)}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground cursor-default">
                            {formatDistanceToNow(item.downloadedAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="glass shadow-dropdown">
                          {new Date(item.downloadedAt).toLocaleString('pt-BR')}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRedownload(item)}
                        disabled={downloadingId === item.id}
                        className="gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {downloadingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Baixar</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      ) : (
        <div className="relative">
          {/* Empty state background */}
          <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent rounded-2xl" />

          <div className="relative glass-card rounded-2xl p-12 shadow-card">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-2xl glass flex items-center justify-center mb-6">
                <FileVideo className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Nenhum download ainda
              </h3>
              <p className="text-muted-foreground max-w-sm">
                Seu historico de downloads aparecera aqui. Cole um link acima para comecar.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
