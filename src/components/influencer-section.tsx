'use client';

import { useState } from 'react';
import { Plus, RefreshCw, AlertCircle, Users, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfluencerCard } from '@/components/influencer-card';
import { AddInfluencerDialog } from '@/components/add-influencer-dialog';
import { InfluencerWithStories } from '@/types';

interface InfluencerSectionProps {
  influencers: InfluencerWithStories[];
  instagramConnected: boolean;
  onAddInfluencer: (username: string) => Promise<void>;
  onRemoveInfluencer: (id: string) => Promise<void>;
  onRefreshStories: () => Promise<void>;
}

export function InfluencerSection({
  influencers,
  instagramConnected,
  onAddInfluencer,
  onRemoveInfluencer,
  onRefreshStories,
}: InfluencerSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshStories();
    setIsRefreshing(false);
  };

  const handleAdd = async (username: string) => {
    setIsAdding(true);
    try {
      await onAddInfluencer(username);
      setIsAddDialogOpen(false);
    } catch {
      // Error is handled by the dialog
    }
    setIsAdding(false);
  };

  const totalStories = influencers.reduce((acc, inf) => acc + inf.stories.length, 0);
  const influencersWithStories = influencers.filter((inf) => inf.stories.length > 0).length;

  return (
    <section className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                Influenciadores
              </h2>
              <p className="text-sm text-muted-foreground">
                {influencers.length > 0 ? (
                  <>
                    {influencers.length} {influencers.length === 1 ? 'perfil monitorado' : 'perfis monitorados'}
                    {totalStories > 0 && (
                      <span className="ml-2 text-success">
                        &middot; {totalStories} stories ativos
                      </span>
                    )}
                  </>
                ) : (
                  'Adicione perfis para monitorar stories'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {influencers.length > 0 && (
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2 glass-subtle border-white/10 hover:bg-white/5 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          )}
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            disabled={influencers.length >= 50}
            className="gap-2 gradient-primary hover:opacity-90 shadow-glow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar perfil</span>
            <span className="sm:hidden">Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Instagram Disconnected Warning */}
      {!instagramConnected && (
        <div className="flex items-center gap-4 rounded-xl glass-subtle border border-destructive/30 p-5">
          <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Sessao do Instagram expirada
            </p>
            <p className="text-sm text-muted-foreground">
              Nao e possivel carregar stories. Reconecte no menu superior.
            </p>
          </div>
        </div>
      )}

      {/* Influencers Grid */}
      {influencers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {influencers.map((influencer) => (
            <InfluencerCard
              key={influencer.id}
              influencer={influencer}
              onRemove={() => onRemoveInfluencer(influencer.id)}
              disabled={!instagramConnected}
            />
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Empty state background */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl" />

          <div className="relative flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl glass-card flex items-center justify-center mb-6 shadow-card">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhum influenciador cadastrado
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Adicione perfis do Instagram para monitorar stories e baixa-los facilmente.
            </p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="gap-2 gradient-primary hover:opacity-90 shadow-glow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              Adicionar primeiro perfil
            </Button>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <AddInfluencerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAdd}
        isLoading={isAdding}
      />
    </section>
  );
}
