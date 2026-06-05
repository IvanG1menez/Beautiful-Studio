'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getAuthHeaders } from '@/lib/auth-headers';
import { obtenerConfigNotificaciones } from '@/services/notificacionesService';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  Gift,
  Loader2,
  Mail,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react';
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
  dias_vencimiento_credito: number;
  dias_rango_reprogramacion: number;
  streak_goal_count: number;
  streak_bonus_amount: string | number;
  streak_coupon_expiration_days: number;
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
        setConfig({
          ...data,
          dias_vencimiento_credito: Math.max(30, Number(data.dias_vencimiento_credito ?? 90)),
          dias_rango_reprogramacion: [7, 14].includes(Number(data.dias_rango_reprogramacion))
            ? Number(data.dias_rango_reprogramacion)
            : 14,
          streak_goal_count: Math.max(1, Number(data.streak_goal_count ?? 5)),
          streak_bonus_amount: data.streak_bonus_amount ?? '0.00',
          streak_coupon_expiration_days: Math.max(1, Number(data.streak_coupon_expiration_days ?? 90)),
        });
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
          'notificar_cancelacion_turno',
          'notificar_nuevo_empleado',
          'notificar_nuevo_cliente',
          'notificar_reporte_diario',
        ];

        const emailKeys: Array<keyof typeof configNotificaciones> = [
          'email_solicitud_turno',
          'email_cancelacion_turno',
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

    if ((config.dias_vencimiento_credito ?? 90) < 30) {
      setError('El vencimiento del crédito debe ser de al menos 30 días.');
      toast.error('El vencimiento del crédito debe ser de al menos 30 días');
      return;
    }

    if (![7, 14].includes(config.dias_rango_reprogramacion ?? 14)) {
      setError('El rango de reprogramación debe ser de 7 o 14 días.');
      toast.error('El rango de reprogramación debe ser de 7 o 14 días');
      return;
    }

    if ((config.streak_goal_count ?? 5) < 1) {
      setError('La meta de racha debe ser de al menos 1 turno.');
      toast.error('La meta de racha debe ser de al menos 1 turno');
      return;
    }

    if ((config.streak_coupon_expiration_days ?? 90) < 1) {
      setError('El vencimiento del cupón de racha debe ser de al menos 1 día.');
      toast.error('El vencimiento del cupón de racha debe ser de al menos 1 día');
      return;
    }

    const confirmed = window.confirm(
      'Vas a modificar el rango permitido para reprogramar turnos. Este cambio aplica a todos los servicios cargados. ¿Querés continuar?'
    );
    if (!confirmed) return;

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
    <div className="min-h-screen bg-gradient-to-b from-purple-50/70 via-white to-white">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-sm">
          <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(147,51,234,0.16),_transparent_36%),linear-gradient(135deg,_#ffffff_0%,_#faf5ff_100%)] p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white/80 px-3 py-1 text-xs font-medium text-purple-700 shadow-sm">
                <Settings className="h-3.5 w-3.5" />
                Panel del propietario
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                  Configuración del sistema
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                  Ajustá la identidad del negocio, las reglas operativas y los accesos avanzados desde un solo lugar.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-500">
                Negocio activo
              </p>
              <div className="mt-3 space-y-1">
                <p className="text-xl font-semibold text-gray-950">
                  {config.nombre_negocio || 'Beautiful Studio'}
                </p>
                <p className="text-sm text-gray-500">
                  Estos cambios se aplican como referencia global en turnos, clientes, créditos y comunicaciones.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="overflow-hidden border-purple-100 shadow-sm">
          <CardHeader className="border-b bg-white/80">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-purple-100 p-3 text-purple-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl">Identidad del negocio</CardTitle>
                <CardDescription>
                  Datos visibles en comunicaciones, reportes y referencias internas del sistema.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombre_negocio">Nombre del negocio</Label>
              <Input
                id="nombre_negocio"
                value={config.nombre_negocio || ''}
                onChange={(e) => handleInputChange('nombre_negocio', e.target.value)}
                placeholder="Ej: Beautiful Studio"
                className="h-11"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={config.direccion || ''}
                onChange={(e) => handleInputChange('direccion', e.target.value)}
                placeholder="Calle, número, ciudad"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono_contacto">Teléfono de contacto</Label>
              <Input
                id="telefono_contacto"
                value={config.telefono_contacto || ''}
                onChange={(e) => handleInputChange('telefono_contacto', e.target.value)}
                placeholder="Ej: +54 9 11 1234-5678"
                className="h-11"
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
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
            <SlidersHorizontal className="h-4 w-4" />
            Reglas operativas
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="border-purple-100 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-purple-100 p-3 text-purple-700">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Switch
                    id="recordatorios_email"
                    checked={config.habilitar_recordatorios_email}
                    onCheckedChange={() => handleToggle('habilitar_recordatorios_email')}
                  />
                </div>
                <div className="space-y-1">
                  <CardTitle>Recordatorios</CardTitle>
                  <CardDescription>Comunicación previa al turno.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Estado</p>
                  <p className="mt-1 text-lg font-semibold text-gray-950">
                    {config.habilitar_recordatorios_email ? 'Email activo' : 'Email desactivado'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_recordatorio_antes_turno">Enviar días antes</Label>
                  <Input
                    id="dias_recordatorio_antes_turno"
                    type="number"
                    min={0}
                    value={config.dias_recordatorio_antes_turno ?? 0}
                    onChange={(e) => handleNumberChange('dias_recordatorio_antes_turno', e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Define con cuánta anticipación recibe el aviso el cliente.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 shadow-sm">
              <CardHeader>
                <div className="w-fit rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle>Billetera y créditos</CardTitle>
                  <CardDescription>Vigencia del crédito por cancelaciones.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Valor actual</p>
                  <p className="mt-1 text-3xl font-bold text-emerald-950">
                    {config.dias_vencimiento_credito ?? 90} días
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_vencimiento_credito">Vencimiento del crédito</Label>
                  <Input
                    id="dias_vencimiento_credito"
                    type="number"
                    min={30}
                    step={1}
                    value={config.dias_vencimiento_credito ?? 90}
                    onChange={(e) => handleNumberChange('dias_vencimiento_credito', e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo permitido: 30 días.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-100 shadow-sm">
              <CardHeader>
                <div className="w-fit rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle>Reprogramaciones</CardTitle>
                  <CardDescription>Rango permitido para mover turnos.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Rango actual</p>
                  <p className="mt-1 text-3xl font-bold text-amber-950">
                    {config.dias_rango_reprogramacion ?? 14} días
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_rango_reprogramacion">
                    Hasta cuándo se puede mover un turno
                  </Label>
                  <Select
                    value={String(config.dias_rango_reprogramacion ?? 14)}
                    onValueChange={(value) => handleNumberChange('dias_rango_reprogramacion', value)}
                  >
                    <SelectTrigger id="dias_rango_reprogramacion" className="h-11">
                      <SelectValue placeholder="Seleccioná un rango" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Durante los próximos 7 días</SelectItem>
                      <SelectItem value="14">Durante los próximos 14 días</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El cliente puede reprogramar cuantas veces quiera, pero solo dentro de este rango.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-violet-100 shadow-sm">
              <CardHeader>
                <div className="w-fit rounded-2xl bg-violet-100 p-3 text-violet-700">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle>Rachas</CardTitle>
                  <CardDescription>Meta, descuento y vencimiento de cupones.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-violet-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Cupón actual</p>
                  <p className="mt-1 text-2xl font-bold text-violet-950">
                    ${Number(config.streak_bonus_amount || 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-xs text-violet-700">
                    cada {config.streak_goal_count ?? 5} turnos
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="streak_goal_count">Meta de turnos</Label>
                  <Input
                    id="streak_goal_count"
                    type="number"
                    min={1}
                    step={1}
                    value={config.streak_goal_count ?? 5}
                    onChange={(e) => handleNumberChange('streak_goal_count', e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="streak_bonus_amount">Descuento del cupón</Label>
                  <Input
                    id="streak_bonus_amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={config.streak_bonus_amount ?? '0'}
                    onChange={(e) => handleInputChange('streak_bonus_amount', e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="streak_coupon_expiration_days">Vencimiento del cupón</Label>
                  <Input
                    id="streak_coupon_expiration_days"
                    type="number"
                    min={1}
                    step={1}
                    value={config.streak_coupon_expiration_days ?? 90}
                    onChange={(e) => handleNumberChange('streak_coupon_expiration_days', e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo puede haber un cupón activo por cliente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b bg-gray-50/80">
            <CardTitle>Otras configuraciones del sistema</CardTitle>
            <CardDescription>
              Accesos rápidos a opciones avanzadas que viven en pantallas dedicadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-purple-100 p-3 text-purple-700">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-semibold text-gray-950">Notificaciones del sistema</h3>
                  {notificacionesResumen.loading ? (
                    <p className="text-sm text-muted-foreground">Cargando estado...</p>
                  ) : notificacionesResumen.error ? (
                    <p className="text-sm text-red-500">{notificacionesResumen.error}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Plataforma: {notificacionesResumen.plataformaActivas}/
                      {notificacionesResumen.plataformaTotales} tipos activos · Email:{' '}
                      {notificacionesResumen.emailActivas}/
                      {notificacionesResumen.emailTotales} activos
                    </p>
                  )}
                </div>
              </div>
              <Button asChild variant="outline" className="mt-5 w-full justify-between">
                <Link href="/dashboard/propietario/notificaciones">
                  Configurar notificaciones
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-semibold text-gray-950">SSO con Google</h3>
                  {ssoResumen.loading ? (
                    <p className="text-sm text-muted-foreground">Cargando estado...</p>
                  ) : ssoResumen.error ? (
                    <p className="text-sm text-red-500">{ssoResumen.error}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Google SSO: {ssoResumen.googleActivo ? 'Activo' : 'Inactivo'} · Autocreación de
                      clientes: {ssoResumen.autoCliente ? 'Activada' : 'Desactivada'} · Credenciales:{' '}
                      {ssoResumen.tieneCredenciales ? 'configuradas' : 'pendientes'}
                    </p>
                  )}
                </div>
              </div>
              <Button asChild variant="outline" className="mt-5 w-full justify-between">
                <Link href="/dashboard/propietario/configuracion-sso">
                  Configurar SSO
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 rounded-full bg-purple-600 px-6 shadow-sm hover:bg-purple-700"
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
    </div>
  );
}
