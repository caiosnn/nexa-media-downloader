'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Key, CheckCircle, XCircle, Loader2, ExternalLink, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface SettingsState {
  rapidApiKey: string;
  rapidApiEnabled: boolean;
  isConfigured: boolean;
  lastUpdated?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>({
    rapidApiKey: '',
    rapidApiEnabled: false,
    isConfigured: false,
  });
  const [newApiKey, setNewApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success && data.settings) {
        setSettings({
          rapidApiKey: data.settings.rapidApiKey || '',
          rapidApiEnabled: data.settings.rapidApiEnabled || false,
          isConfigured: data.settings.isConfigured || false,
          lastUpdated: data.settings.lastUpdated,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Erro ao carregar configuracoes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rapidApiKey: newApiKey || settings.rapidApiKey,
          rapidApiEnabled: settings.rapidApiEnabled,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Configuracoes salvas com sucesso!');
        setSettings({
          rapidApiKey: data.settings.rapidApiKey,
          rapidApiEnabled: data.settings.rapidApiEnabled,
          isConfigured: data.settings.isConfigured,
          lastUpdated: data.settings.lastUpdated,
        });
        setNewApiKey('');
      } else {
        toast.error(data.error || 'Erro ao salvar configuracoes');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configuracoes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const keyToTest = newApiKey || settings.rapidApiKey;

    if (!keyToTest || keyToTest === '****') {
      toast.error('Insira uma API key para testar');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult('success');
        toast.success('Conexao testada com sucesso!');
      } else {
        setTestResult('error');
        toast.error(data.error || 'Falha no teste de conexao');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResult('error');
      toast.error('Erro ao testar conexao');
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = () => {
    setSettings(prev => ({
      ...prev,
      rapidApiEnabled: !prev.rapidApiEnabled,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full">
        <div className="absolute inset-0 glass border-b border-border/50" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative container mx-auto flex h-16 items-center justify-between px-4 md:px-8 lg:px-12">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Voltar</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Image
              src="/logo-pl.svg"
              alt="Partido Liberal"
              width={32}
              height={35}
              className="h-8 w-auto"
            />
            <span className="text-lg font-semibold text-foreground">Configuracoes</span>
          </div>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-8 lg:px-12 py-8 max-w-2xl">
        {/* RapidAPI Configuration Card */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">RapidAPI - Instagram Scraper</CardTitle>
                <CardDescription>
                  Configure a API para download de stories com alta taxa de sucesso
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              {settings.isConfigured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-success" />
                  <span className="text-sm font-medium text-success">API configurada</span>
                  {settings.lastUpdated && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Atualizado em {new Date(settings.lastUpdated).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <span className="text-sm font-medium text-warning">API nao configurada</span>
                </>
              )}
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <div>
                <p className="font-medium">Habilitar RapidAPI</p>
                <p className="text-sm text-muted-foreground">
                  Usar como metodo principal para download de stories
                </p>
              </div>
              <Button
                variant={settings.rapidApiEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleToggleEnabled}
                className={settings.rapidApiEnabled ? "bg-primary" : ""}
              >
                {settings.rapidApiEnabled ? "Habilitado" : "Desabilitado"}
              </Button>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={settings.isConfigured ? settings.rapidApiKey : "Cole sua RapidAPI key aqui"}
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || (!newApiKey && !settings.isConfigured)}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : testResult === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : testResult === 'error' ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    "Testar"
                  )}
                </Button>
              </div>
              {testResult === 'success' && (
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conexao testada com sucesso!
                </p>
              )}
              {testResult === 'error' && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Falha no teste. Verifique sua API key.
                </p>
              )}
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar Configuracoes"
              )}
            </Button>

            {/* How to get API key */}
            <div className="p-4 rounded-lg bg-muted/30 space-y-3">
              <h4 className="font-medium text-sm">Como obter uma API key:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Crie uma conta gratuita em <a href="https://rapidapi.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">rapidapi.com <ExternalLink className="h-3 w-3" /></a></li>
                <li>Busque por &quot;Instagram Scraper API2&quot;</li>
                <li>Assine o plano gratuito (100 req/mes)</li>
                <li>Copie a API key do dashboard</li>
                <li>Cole aqui e clique em &quot;Testar&quot;</li>
              </ol>
            </div>

            {/* Pricing Info */}
            <div className="border-t border-border/50 pt-4">
              <h4 className="font-medium text-sm mb-3">Planos disponiveis:</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="font-semibold">Basic</p>
                  <p className="text-muted-foreground text-xs">100 req/mes</p>
                  <p className="text-success font-medium">Gratis</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="font-semibold">Pro</p>
                  <p className="text-muted-foreground text-xs">10.000 req/mes</p>
                  <p className="text-primary font-medium">$10/mes</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="font-semibold">Ultra</p>
                  <p className="text-muted-foreground text-xs">100.000 req/mes</p>
                  <p className="text-primary font-medium">$50/mes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Sobre o sistema de fallback</p>
                <p>
                  Quando a RapidAPI esta habilitada, ela e usada como metodo principal para download de stories.
                  Se falhar ou nao estiver configurada, o sistema automaticamente tenta outros metodos
                  (Web API, GraphQL, Puppeteer, Instaloader, yt-dlp).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
