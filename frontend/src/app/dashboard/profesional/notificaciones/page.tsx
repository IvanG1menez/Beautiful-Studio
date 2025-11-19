'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  actualizarConfigNotificaciones,
  NotificacionConfig,
  obtenerConfigNotificaciones,
} from '@/services/notificacionesService';
import { Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ConfiguracionNotificacionesPage() {
  const [config, setConfig] = useState<NotificacionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cargar configuración
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await obtenerConfigNotificaciones();
        setConfig(data);
      } catch (error) {
        console.error('Error cargando configuración:', error);
        toast.error('No se pudo cargar la configuración de notificaciones');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Actualizar configuración
  const handleToggle = (field: keyof NotificacionConfig) => {
    if (!config) return;
    setConfig({
      ...config,
      [field]: !config[field],
    });
  };

  // Guardar cambios
  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      await actualizarConfigNotificaciones(config);
      toast.success('Tus preferencias de notificaciones se han actualizado correctamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
              No se pudo cargar la configuración de notificaciones
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold">Configuración de Notificaciones</h1>
        </div>
        <p className="text-muted-foreground">
          Personaliza qué notificaciones deseas recibir
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias de Notificaciones</CardTitle>
          <CardDescription>
            Activa o desactiva los tipos de notificaciones que deseas recibir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notificaciones de turnos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notificaciones de Turnos</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="solicitud_turno" className="text-base cursor-pointer">
                  Solicitud de turno
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones cuando un cliente solicita un turno contigo
                </p>
              </div>
              <Switch
                id="solicitud_turno"
                checked={config.notificar_solicitud_turno}
                onCheckedChange={() => handleToggle('notificar_solicitud_turno')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pago_turno" className="text-base cursor-pointer">
                  Pago de turno
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones cuando un cliente paga un turno
                </p>
              </div>
              <Switch
                id="pago_turno"
                checked={config.notificar_pago_turno}
                onCheckedChange={() => handleToggle('notificar_pago_turno')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cancelacion_turno" className="text-base cursor-pointer">
                  Cancelación de turno
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones cuando un cliente cancela un turno
                </p>
              </div>
              <Switch
                id="cancelacion_turno"
                checked={config.notificar_cancelacion_turno}
                onCheckedChange={() => handleToggle('notificar_cancelacion_turno')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="modificacion_turno" className="text-base cursor-pointer">
                  Modificación de turno
                </Label>
                <p className="text-sm text-muted-foreground">
                  Recibe notificaciones cuando se modifica un turno
                </p>
              </div>
              <Switch
                id="modificacion_turno"
                checked={config.notificar_modificacion_turno}
                onCheckedChange={() => handleToggle('notificar_modificacion_turno')}
              />
            </div>
          </div>

          {/* Botón guardar */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
