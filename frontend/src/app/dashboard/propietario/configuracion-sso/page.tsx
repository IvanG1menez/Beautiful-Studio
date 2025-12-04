'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, Loader2, Save, Settings, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SSOConfig {
  id: number;
  google_sso_activo: boolean;
  autocreacion_cliente_sso: boolean;
  client_id: string;
  client_secret: string;
}

export default function ConfiguracionSSOPage() {
  const [config, setConfig] = useState<SSOConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/auth/configuracion/sso/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar la configuración');
      }

      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      setError('No se pudo cargar la configuración de SSO');
      toast.error('Error al cargar la configuración');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setError('');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_URL}/auth/configuracion/sso/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Error al guardar la configuración');
      }

      const data = await response.json();
      setConfig(data);
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      setError('No se pudo guardar la configuración');
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (field: keyof SSOConfig) => {
    if (!config) return;
    setConfig({ ...config, [field]: !config[field] });
  };

  const handleInputChange = (field: keyof SSOConfig, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración SSO</h1>
          <p className="text-gray-600">Gestiona el inicio de sesión con Google OAuth</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Card Principal: Activación de Google SSO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Estado de Google SSO
          </CardTitle>
          <CardDescription>
            Permite a los usuarios iniciar sesión con sus cuentas de Google
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="google-sso" className="text-base font-medium">
                Activar Google SSO
              </Label>
              <p className="text-sm text-gray-500">
                Mostrar el botón "Continuar con Google" en login y registro
              </p>
            </div>
            <Switch
              id="google-sso"
              checked={config?.google_sso_activo || false}
              onCheckedChange={() => handleToggle('google_sso_activo')}
            />
          </div>

          {config?.google_sso_activo && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Google SSO está activo
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card: Autocreación de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Autocreación de Clientes</CardTitle>
          <CardDescription>
            Configuración para usuarios que se registran con Google
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-cliente" className="text-base font-medium">
                Crear perfil de Cliente automáticamente
              </Label>
              <p className="text-sm text-gray-500">
                Asignar rol de Cliente a nuevos usuarios registrados con Google
              </p>
            </div>
            <Switch
              id="auto-cliente"
              checked={config?.autocreacion_cliente_sso || false}
              onCheckedChange={() => handleToggle('autocreacion_cliente_sso')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card: Credenciales de Google OAuth */}
      <Card>
        <CardHeader>
          <CardTitle>Credenciales de Google Cloud</CardTitle>
          <CardDescription>
            Configura las credenciales OAuth de Google Cloud Console
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              type="text"
              value={config?.client_id || ''}
              onChange={(e) => handleInputChange('client_id', e.target.value)}
              placeholder="1234567890-abcdefghijklmnop.apps.googleusercontent.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Obtén este valor en Google Cloud Console → APIs & Services → Credentials
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <div className="relative">
              <Input
                id="client-secret"
                type={showSecret ? 'text' : 'password'}
                value={config?.client_secret || ''}
                onChange={(e) => handleInputChange('client_secret', e.target.value)}
                placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Client Secret de Google Cloud Console (se guarda de forma segura)
            </p>
          </div>

          {/* Información de configuración */}
          <Alert>
            <AlertDescription className="text-xs space-y-2">
              <p className="font-semibold">Pasos para configurar Google OAuth:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Ve a <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                <li>Crea un nuevo proyecto o selecciona uno existente</li>
                <li>Habilita "Google+ API"</li>
                <li>Ve a "Credentials" y crea "OAuth 2.0 Client ID"</li>
                <li>Agrega las URLs autorizadas:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">http://localhost:8000</code></li>
                    <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">http://localhost:8000/api/auth/complete/google-oauth2/</code></li>
                  </ul>
                </li>
                <li>Copia Client ID y Client Secret aquí</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Botón de guardar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
