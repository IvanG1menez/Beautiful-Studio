"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  actualizarConfigNotificaciones,
  obtenerConfigNotificaciones,
  type NotificacionConfig,
} from "@/services/notificacionesService";
import { useEffect, useState } from "react";

export default function ConfiguracionProfesionalPage() {
  const { user } = useAuth();
  const [configNotificaciones, setConfigNotificaciones] = useState<NotificacionConfig | null>(null);
  const [emailRecordatorios, setEmailRecordatorios] = useState<boolean>(true);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(false);
  const [guardandoNotificaciones, setGuardandoNotificaciones] = useState(false);
  const [bio, setBio] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTelefono((user as any)?.phone || "");
  }, [user]);

  useEffect(() => {
    const loadNotificaciones = async () => {
      try {
        setCargandoNotificaciones(true);
        const config = await obtenerConfigNotificaciones();
        setConfigNotificaciones(config);
        setEmailRecordatorios(config.email_recordatorio_turno);
      } catch (error) {
        console.error("Error al cargar configuración de notificaciones:", error);
      } finally {
        setCargandoNotificaciones(false);
      }
    };

    loadNotificaciones();
  }, []);

  const handleGuardarPerfil = async () => {
    setGuardando(true);
    try {
      // aquí iría la llamada al backend para actualizar datos básicos del profesional
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleEmailRecordatorios = async (checked: boolean) => {
    setEmailRecordatorios(checked);

    try {
      setGuardandoNotificaciones(true);
      await actualizarConfigNotificaciones({ email_recordatorio_turno: checked });
      // Refrescamos localmente la config mínima
      setConfigNotificaciones((prev) =>
        prev ? { ...prev, email_recordatorio_turno: checked } : prev
      );
    } catch (error) {
      console.error("Error al actualizar recordatorios por email:", error);
      // Revertir en caso de error
      setEmailRecordatorios((prev) => !checked);
    } finally {
      setGuardandoNotificaciones(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-1">
          <p className="text-sm text-gray-500">Configuración</p>
          <h1 className="text-2xl font-bold text-gray-900">Preferencias del profesional</h1>
          <p className="text-sm text-gray-600">
            Ajusta tus datos básicos y cómo quieres recibir notificaciones sobre tus turnos.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Perfil profesional</CardTitle>
              <CardDescription>
                Información básica que se muestra a los clientes en tus turnos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={`${user?.first_name || ""} ${user?.last_name || ""}`.trim()}
                  disabled
                />
              </div>
              <div>
                <Label>Correo electrónico</Label>
                <Input value={user?.email || ""} disabled />
              </div>
              <div>
                <Label htmlFor="telefono">Teléfono de contacto</Label>
                <Input
                  id="telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: +54 9 11 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="bio">Descripción corta</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cuenta en pocas líneas tu estilo de trabajo, especialidades o lo que quieras que el cliente sepa de vos."
                />
              </div>
              <Button onClick={handleGuardarPerfil} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificaciones de turnos</CardTitle>
              <CardDescription>
                Define cómo quieres que te avisemos sobre nuevos turnos y recordatorios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cargandoNotificaciones && (
                <p className="text-xs text-gray-500">
                  Cargando preferencias de notificaciones...
                </p>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Recordatorios por email</Label>
                  <p className="text-xs text-gray-500">
                    Te enviaremos un correo antes de cada turno para que no se te pase nada.
                  </p>
                </div>
                <Switch
                  checked={emailRecordatorios}
                  disabled={cargandoNotificaciones || guardandoNotificaciones}
                  onCheckedChange={handleToggleEmailRecordatorios}
                />
              </div>

              <p className="text-xs text-gray-500">
                Estas preferencias aplican sólo a tu perfil profesional. La configuración general del negocio se administra desde el panel del propietario.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
