'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getAuthHeaders } from '@/lib/auth-headers';
import { obtenerConfigNotificaciones } from '@/services/notificacionesService';
import { Bell, Loader2, Save, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ConfiguracionGlobal {
  id: number;
  nombre_negocio: string;
  direccion?: string;
  telefono_contacto?: string;
  email_contacto?: string;
  habilitar_recordatorios_email: boolean;
  dias_recordatorio_antes_turno: number;
}

export default function ConfiguracionGlobalPage() {
  const [config, setConfig] = useState<ConfiguracionGlobal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notificacionesResumen, setNotificacionesResumen] = useState({
    loading: true,
    error: '',
    plataformaActivas: 0,
    plataformaTotales: 0,
    emailActivas: 0,
    emailTotales: 0,
  });
  const [ssoResumen, setSsoResumen] = useState({
    loading: true,
    error: '',
    googleActivo: false,
    autoCliente: false,
    tieneCredenciales: false,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const baseUrl = '/api';
        const response = await fetch(`${baseUrl}/configuracion/global/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Error al cargar la configuración');
        }

        const data = await response.json();
        setConfig(data);
      } catch (err) {
        console.error('Error al cargar configuración global:', err);
        setError('No se pudo cargar la configuración global del negocio');
        toast.error('Error al cargar la configuración global');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();

    const loadNotificaciones = async () => {
      try {
        const configNotificaciones = await obtenerConfigNotificaciones();

        const plataformaKeys: Array<keyof typeof configNotificaciones> = [
          'notificar_solicitud_turno',
          'notificar_pago_turno',
          'notificar_cancelacion_turno',
          'notificar_modificacion_turno',
          'notificar_nuevo_empleado',
          'notificar_nuevo_cliente',
          'notificar_reporte_diario',
        ];

        const emailKeys: Array<keyof typeof configNotificaciones> = [
          'email_solicitud_turno',
          'email_pago_turno',
          'email_cancelacion_turno',
          'email_modificacion_turno',
          'email_recordatorio_turno',
          'email_reporte_diario',
        ];

        const plataformaActivas = plataformaKeys.filter((key) => configNotificaciones[key]).length;
        const emailActivas = emailKeys.filter((key) => configNotificaciones[key]).length;

        setNotificacionesResumen({
          loading: false,
          error: '',
          plataformaActivas,
          plataformaTotales: plataformaKeys.length,
          emailActivas,
          emailTotales: emailKeys.length,
        });
      } catch (e) {
        console.error('Error cargando resumen de notificaciones:', e);
        setNotificacionesResumen((prev) => ({
          ...prev,
          loading: false,
          error: 'No se pudo cargar el estado de las notificaciones',
        }));
      }
    };

    const loadSSO = async () => {
      try {
        const baseUrl = '/api';
        const response = await fetch(`${baseUrl}/configuracion/sso/`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Error al cargar configuración SSO');
        }

        const data = await response.json();

        setSsoResumen({
          loading: false,
          error: '',
          googleActivo: Boolean(data.google_sso_activo),
          autoCliente: Boolean(data.autocreacion_cliente_sso),
          tieneCredenciales: Boolean(data.client_id),
        });
      } catch (e) {
        console.error('Error cargando resumen de SSO:', e);
        setSsoResumen((prev) => ({
          ...prev,
          loading: false,
          error: 'No se pudo cargar el estado de SSO',
        }));
      }
    };

    loadNotificaciones();
    loadSSO();
  }, []);

  const handleToggle = (field: keyof ConfiguracionGlobal) => {
    if (!config) return;
    setConfig({ ...config, [field]: !config[field] } as ConfiguracionGlobal);
  };

  const handleInputChange = (field: keyof ConfiguracionGlobal, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value } as ConfiguracionGlobal);
  };

  const handleNumberChange = (field: keyof ConfiguracionGlobal, value: string) => {
    if (!config) return;
    const parsed = parseInt(value || '0', 10);
    setConfig({ ...config, [field]: isNaN(parsed) ? 0 : parsed } as ConfiguracionGlobal);
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setIsSaving(true);
      setError('');

      const baseUrl = '/api';
      const response = await fetch(`${baseUrl}/configuracion/global/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Error al guardar la configuración');
      }

      const data = await response.json();
      setConfig(data);
      toast.success('Configuración global guardada exitosamente');
    } catch (err) {
      console.error('Error al guardar configuración global:', err);
      setError('No se pudo guardar la configuración global');
      toast.error('Error al guardar la configuración global');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No se pudo cargar la configuración global del negocio
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración Global</h1>
          <p className="text-gray-600">
            Administra la configuración general de tu negocio. Estos valores se usan como referencia en todo el sistema.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos del Negocio</CardTitle>
          <CardDescription>Información básica utilizada en comunicaciones y reportes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre_negocio">Nombre del Negocio</Label>
            <Input
              id="nombre_negocio"
              value={config.nombre_negocio || ''}
              onChange={(e) => handleInputChange('nombre_negocio', e.target.value)}
              placeholder="Ej: Beautiful Studio"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={config.direccion || ''}
              onChange={(e) => handleInputChange('direccion', e.target.value)}
              placeholder="Calle, número, ciudad"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono_contacto">Teléfono de contacto</Label>
              <Input
                id="telefono_contacto"
                value={config.telefono_contacto || ''}
                onChange={(e) => handleInputChange('telefono_contacto', e.target.value)}
                placeholder="Ej: +54 9 11 1234-5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_contacto">Email de contacto</Label>
              <Input
                id="email_contacto"
                type="email"
                value={config.email_contacto || ''}
                onChange={(e) => handleInputChange('email_contacto', e.target.value)}
                placeholder="contacto@tu-negocio.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recordatorios de Turnos</CardTitle>
          <CardDescription>Configura cómo se recordarán los turnos a tus clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="recordatorios_email" className="text-base font-medium">
                Recordatorios por email
              </Label>
              <p className="text-sm text-muted-foreground">
                Enviar recordatorios de turnos a la casilla de correo del cliente.
              </p>
            </div>
            <Switch
              id="recordatorios_email"
              checked={config.habilitar_recordatorios_email}
              onCheckedChange={() => handleToggle('habilitar_recordatorios_email')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias_recordatorio_antes_turno">Días de anticipación del recordatorio</Label>
            <Input
              id="dias_recordatorio_antes_turno"
              type="number"
              min={0}
              value={config.dias_recordatorio_antes_turno ?? 0}
              onChange={(e) => handleNumberChange('dias_recordatorio_antes_turno', e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Cantidad de días antes del turno en los que se enviará el recordatorio.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Otras configuraciones del sistema</CardTitle>
          <CardDescription>
            Accesos directos a todas las configuraciones avanzadas que ya conocés del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Estado de notificaciones</span>
              </div>
              {notificacionesResumen.loading ? (
                <p className="text-xs text-muted-foreground">Cargando estado de notificaciones...</p>
              ) : notificacionesResumen.error ? (
                <p className="text-xs text-red-500">{notificacionesResumen.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Plataforma: {notificacionesResumen.plataformaActivas}/
                  {notificacionesResumen.plataformaTotales} tipos activos · Email:{' '}
                  {notificacionesResumen.emailActivas}/
                  {notificacionesResumen.emailTotales} activos
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Estado de SSO (Google)</span>
              </div>
              {ssoResumen.loading ? (
                <p className="text-xs text-muted-foreground">Cargando estado de SSO...</p>
              ) : ssoResumen.error ? (
                <p className="text-xs text-red-500">{ssoResumen.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Google SSO: {ssoResumen.googleActivo ? 'Activo' : 'Inactivo'} · Autocreación de
                  clientes: {ssoResumen.autoCliente ? 'Activada' : 'Desactivada'} · Credenciales:{' '}
                  {ssoResumen.tieneCredenciales ? 'configuradas' : 'pendientes'}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/dashboard/propietario/notificaciones">
                <Bell className="mr-2 h-4 w-4" />
                Notificaciones del sistema
              </Link>
            </Button>

            <Button asChild variant="outline" className="justify-start">
              <Link href="/dashboard/propietario/configuracion-sso">
                <Shield className="mr-2 h-4 w-4" />
                Configuración de SSO (Google)
              </Link>
            </Button>

            <Button asChild variant="outline" className="justify-start">
              <Link href="/dashboard/propietario/encuestas?tab=configuracion">
                <Settings className="mr-2 h-4 w-4" />
                Configuración de encuestas
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

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
