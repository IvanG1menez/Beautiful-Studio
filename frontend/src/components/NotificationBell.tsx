'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  Notificacion,
  obtenerNotificacionesNoLeidas,
  obtenerNotificacionesRecientes,
} from '@/services/notificacionesService';
import { Bell, Check, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function NotificationBell() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [contador, setContador] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Cargar notificaciones
  const loadNotificaciones = async () => {
    try {
      const [recientes, noLeidas] = await Promise.all([
        obtenerNotificacionesRecientes(),
        obtenerNotificacionesNoLeidas(),
      ]);
      setNotificaciones(recientes);
      setContador(noLeidas.count);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  };

  useEffect(() => {
    loadNotificaciones();

    // Actualizar cada 30 segundos
    const interval = setInterval(loadNotificaciones, 30000);
    return () => clearInterval(interval);
  }, []);

  // Marcar notificación como leída
  const handleMarcarLeida = async (id: number) => {
    try {
      await marcarNotificacionLeida(id);
      await loadNotificaciones();
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  };

  // Marcar todas como leídas
  const handleMarcarTodasLeidas = async () => {
    try {
      setLoading(true);
      await marcarTodasLeidas();
      await loadNotificaciones();
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Iconos por tipo de notificación
  const getTipoIcon = (tipo: Notificacion['tipo']) => {
    switch (tipo) {
      case 'solicitud_turno':
        return '📅';
      case 'pago_turno':
        return '💰';
      case 'cancelacion_turno':
        return '❌';
      case 'modificacion_turno':
        return '✏️';
      case 'nuevo_empleado':
        return '👤';
      case 'nuevo_cliente':
        return '👥';
      case 'reporte_diario':
        return '📊';
      default:
        return '🔔';
    }
  };

  const getConfiguracionNotificacionesRoute = () => {
    const role = user?.role?.toLowerCase();

    if (role === 'propietario' || role === 'superusuario') {
      // Para el administrador, apuntamos a la configuración global
      return '/dashboard/propietario/configuracion';
    }

    if (role === 'profesional') {
      // Pestaña de notificaciones del perfil profesional
      return '/dashboard/profesional/perfil?tab=notificaciones';
    }

    if (role === 'cliente') {
      // Pestaña de notificaciones del perfil cliente
      return '/dashboard/cliente/perfil?tab=notificaciones';
    }

    return '/configuracion';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {contador > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {contador > 9 ? '9+' : contador}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notificaciones</h3>
            {contador === 0 && (
              <Check className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div className="flex items-center gap-1">
            {contador > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMarcarTodasLeidas}
                disabled={loading}
                className="h-7 w-7"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setIsOpen(false);
                router.push(getConfiguracionNotificacionesRoute());
              }}
              aria-label="Configuración de notificaciones"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {notificaciones.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No tienes notificaciones
            </div>
          ) : (
            <div className="divide-y">
              {notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${!notif.leida ? 'bg-blue-50/50' : ''
                    }`}
                  onClick={() => handleMarcarLeida(notif.id)}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl shrink-0">
                      {getTipoIcon(notif.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {notif.titulo}
                        </p>
                        {!notif.leida && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notif.mensaje}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {notif.tiempo_transcurrido}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notificaciones.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                setIsOpen(false);
                // Aquí puedes agregar navegación a una página de todas las notificaciones
              }}
            >
              Ver todas las notificaciones
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
