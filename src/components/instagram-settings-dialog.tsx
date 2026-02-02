'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Instagram,
  Loader2,
  Check,
  X,
  LogOut,
  Key,
  FileText,
  Shield,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface ApiInstagramStatus {
  connected: boolean;
  username?: string;
  method?: 'session' | 'cookies';
  lastUpdated?: string;
}

interface InstagramSettingsDialogProps {
  onStatusChange?: (status: { connected: boolean; username?: string }) => void;
}

export function InstagramSettingsDialog({ onStatusChange }: InstagramSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ApiInstagramStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Cookies form
  const [cookiesText, setCookiesText] = useState('');

  // Fetch status on mount and when dialog opens
  useEffect(() => {
    if (open) {
      fetchStatus();
    }
  }, [open]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/instagram/status');
      const data = await res.json();
      setStatus(data);
      onStatusChange?.({ connected: data.connected, username: data.username });
    } catch {
      console.error('Failed to fetch Instagram status');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/instagram/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(data.message);
        setUsername('');
        setPassword('');
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Erro de conexao. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/instagram/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesText }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(data.message);
        setCookiesText('');
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Erro ao importar cookies. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/instagram/logout', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(data.message);
        await fetchStatus();
      }
    } catch {
      setError('Erro ao fazer logout.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg glass shadow-dropdown border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shadow-glow-sm">
              <Instagram className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Configuracoes do Instagram</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Configure sua conta para baixar stories
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status Banner */}
        <div className={`flex items-center gap-3 p-4 rounded-xl ${
          status.connected
            ? 'bg-success/10 border border-success/20'
            : 'bg-muted/50 border border-border/50'
        }`}>
          {status.connected ? (
            <>
              <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  Conectado {status.username && `como @${status.username}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {status.method === 'session' ? 'Via login' : 'Via cookies'}
                  {status.lastUpdated && ` • Atualizado em ${new Date(status.lastUpdated).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <X className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Nao conectado</p>
                <p className="text-sm text-muted-foreground">
                  Configure sua conta para baixar stories
                </p>
              </div>
            </>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
            <Check className="h-5 w-5 text-success flex-shrink-0" />
            <p className="text-sm text-success">{success}</p>
          </div>
        )}

        {/* Configuration Tabs */}
        {!status.connected && (
          <Tabs defaultValue="cookies" className="mt-2">
            <TabsList className="grid w-full grid-cols-2 glass-subtle">
              <TabsTrigger value="cookies" className="gap-2">
                <FileText className="h-4 w-4" />
                Importar Cookies
              </TabsTrigger>
              <TabsTrigger value="login" className="gap-2">
                <Key className="h-4 w-4" />
                Login
              </TabsTrigger>
            </TabsList>

            {/* Cookies Tab */}
            <TabsContent value="cookies" className="space-y-4 mt-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Metodo Recomendado
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Exporte os cookies do Instagram usando uma extensao do navegador e cole aqui.
                  Este metodo e mais seguro e nao requer sua senha.
                </p>
                <a
                  href="https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Baixar extensao "Get cookies.txt LOCALLY"
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <form onSubmit={handleImportCookies} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Cole o conteudo do arquivo cookies.txt
                  </label>
                  <textarea
                    value={cookiesText}
                    onChange={(e) => setCookiesText(e.target.value)}
                    placeholder="# Netscape HTTP Cookie File&#10;.instagram.com&#9;TRUE&#9;/&#9;TRUE&#9;..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl glass-input border border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono resize-none"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !cookiesText.trim()}
                  className="w-full gradient-primary hover:opacity-90 shadow-glow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Importar Cookies
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Aviso
                </h4>
                <p className="text-sm text-muted-foreground">
                  Se sua conta tiver autenticacao de dois fatores (2FA) ativada,
                  use o metodo de importar cookies. O login direto nao suporta 2FA.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Username do Instagram
                  </label>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="seu_username"
                    disabled={isLoading}
                    className="h-12 glass-input rounded-xl border-white/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Senha
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="h-12 glass-input rounded-xl border-white/10"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !username.trim() || !password.trim()}
                  className="w-full gradient-primary hover:opacity-90 shadow-glow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Fazer Login
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {/* Instructions when connected */}
        {status.connected && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-sm text-muted-foreground">
              Sua sessao esta ativa. Agora voce pode baixar stories de perfis publicos
              colando o link do story na pagina principal.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
