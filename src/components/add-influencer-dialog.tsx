'use client';

import { useState } from 'react';
import { Loader2, User, AtSign, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddInfluencerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (username: string) => Promise<void>;
  isLoading: boolean;
}

export function AddInfluencerDialog({
  open,
  onOpenChange,
  onAdd,
  isLoading,
}: AddInfluencerDialogProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim().replace(/^@/, '');

    if (!cleanUsername) {
      setError('Digite um username');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      setError('Username invalido. Use apenas letras, numeros, pontos e underscores.');
      return;
    }

    setError('');
    try {
      await onAdd(cleanUsername);
      setUsername('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar perfil';
      setError(message);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUsername('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md glass shadow-dropdown border-border/50">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Adicionar perfil</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Monitore stories do Instagram
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Username do Instagram
            </label>
            <div className="relative group">
              {/* Input glow on focus */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/30 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center">
                <div className="absolute left-3 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <AtSign className="h-4 w-4 text-primary" />
                </div>
                <Input
                  placeholder="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  className="pl-14 h-12 glass-input rounded-xl border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Digite apenas o username, sem o @
            </p>
          </div>

          <DialogFooter className="gap-3 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
              className="glass-subtle border-white/10 hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !username.trim()}
              className="gradient-primary hover:opacity-90 shadow-glow-sm gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <User className="h-4 w-4" />
                  Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
