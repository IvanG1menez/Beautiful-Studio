'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Calendar, Loader2, Mail, Phone, TrendingUp, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ServicioFrecuente {
  id: number;
  nombre: string;
  precio: number;
  cantidad_veces: number;
}

interface ClienteInactivo {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  ultimo_turno: string;
  dias_sin_turno: number;
  total_turnos_historico: number;
  servicio_frecuente: ServicioFrecuente | null;
}

interface Configuracion {
  dias_inactividad_umbral: number;
  descuento_fidelizacion_pct: number;
}

interface OportunidadesData {
  configuracion: Configuracion;
  total_oportunidades: number;
  clientes: ClienteInactivo[];
}

export default function OportunidadesAgendaPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OportunidadesData | null>(null);
  const [diasInactividad, setDiasInactividad] = useState<number>(60);
  const [selectedCliente, setSelectedCliente] = useState<ClienteInactivo | null>(null);
  const [showInvitarDialog, setShowInvitarDialog] = useState(false);
  const [mensajePersonalizado, setMensajePersonalizado] = useState('');
  const [enviando, setEnviando] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Token ${token}` : '',
    };
  };

  const fetchOportunidades = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (diasInactividad) {
        params.append('dias_inactividad', diasInactividad.toString());
      }

      const response = await fetch(
        `http://localhost:8000/api/turnos/oportunidades/?${params.toString()}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
        setDiasInactividad(result.configuracion.dias_inactividad_umbral);
      } else {
        toast.error('Error al cargar oportunidades');
      }
    } catch (error) {
      console.error('Error fetching oportunidades:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOportunidades();
  }, []);

  const handleInvitar = (cliente: ClienteInactivo) => {
    setSelectedCliente(cliente);
    setShowInvitarDialog(true);
    setMensajePersonalizado('');
  };

  const handleEnviarInvitacion = async () => {
    if (!selectedCliente || !data) return;

    setEnviando(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/turnos/oportunidades/${selectedCliente.id}/invitar/`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            servicio_id: selectedCliente.servicio_frecuente?.id,
            mensaje_personalizado: mensajePersonalizado,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success('Invitación enviada exitosamente');
        setShowInvitarDialog(false);
        setSelectedCliente(null);
      } else {
        toast.error('Error al enviar invitación');
      }
    } catch (error) {
      console.error('Error enviando invitación:', error);
      toast.error('Error al enviar invitación');
    } finally {
      setEnviando(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const calcularPrecioConDescuento = (precioOriginal: number, descuentoPct: number) => {
    return precioOriginal * (1 - descuentoPct / 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🎯 Oportunidades de Agenda</h1>
        <p className="text-gray-600 mt-1">
          Clientes inactivos y oportunidades de reincorporación
        </p>
      </div>

      {/* Filtros y Configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Configuración de Búsqueda
          </CardTitle>
          <CardDescription>Ajusta los parámetros para identificar oportunidades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dias_inactividad">Días de inactividad</Label>
              <Input
                id="dias_inactividad"
                type="number"
                min="0"
                value={diasInactividad}
                onChange={(e) => setDiasInactividad(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchOportunidades} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  'Buscar Oportunidades'
                )}
              </Button>
            </div>
            {data && (
              <div className="flex items-end">
                <div className="w-full p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-medium">
                    Descuento automático: {data.configuracion.descuento_fidelizacion_pct}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Oportunidades</p>
                    <p className="text-3xl font-bold text-gray-900">{data.total_oportunidades}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Umbral de Inactividad</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {data.configuracion.dias_inactividad_umbral}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">días sin turno</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Descuento Oferta</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {data.configuracion.descuento_fidelizacion_pct}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">aplicado automáticamente</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Clientes */}
          {data.clientes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Clientes Inactivos</CardTitle>
                <CardDescription>
                  Clientes que no asisten hace más de {data.configuracion.dias_inactividad_umbral}{' '}
                  días
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.clientes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{cliente.nombre}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  {cliente.email}
                                </span>
                                {cliente.telefono && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {cliente.telefono}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <p className="text-gray-500">Último turno</p>
                              <p className="font-medium text-gray-900">
                                {formatDate(cliente.ultimo_turno)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Días sin turno</p>
                              <p className="font-bold text-orange-600">{cliente.dias_sin_turno}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Total histórico</p>
                              <p className="font-medium text-gray-900">
                                {cliente.total_turnos_historico} turnos
                              </p>
                            </div>
                            {cliente.servicio_frecuente && (
                              <div>
                                <p className="text-gray-500">Servicio más frecuente</p>
                                <p className="font-medium text-gray-900">
                                  {cliente.servicio_frecuente.nombre}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {cliente.servicio_frecuente.cantidad_veces} veces
                                </p>
                              </div>
                            )}
                          </div>

                          {cliente.servicio_frecuente && (
                            <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="text-sm font-medium text-green-900">
                                Oferta sugerida con {data.configuracion.descuento_fidelizacion_pct}%
                                descuento:
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-lg font-bold text-green-700">
                                  {formatCurrency(
                                    calcularPrecioConDescuento(
                                      cliente.servicio_frecuente.precio,
                                      data.configuracion.descuento_fidelizacion_pct
                                    )
                                  )}
                                </span>
                                <span className="text-sm text-gray-500 line-through">
                                  {formatCurrency(cliente.servicio_frecuente.precio)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <Button onClick={() => handleInvitar(cliente)} size="sm">
                            <Mail className="w-4 h-4 mr-2" />
                            Enviar Invitación
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">
                    No se encontraron clientes inactivos con los criterios seleccionados
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Intenta ajustar el número de días de inactividad
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Dialog de Invitación */}
      <Dialog open={showInvitarDialog} onOpenChange={setShowInvitarDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar Invitación de Reincorporación</DialogTitle>
            <DialogDescription>
              Enviarás una invitación con descuento especial a {selectedCliente?.nombre}
            </DialogDescription>
          </DialogHeader>

          {selectedCliente && data && (
            <div className="space-y-4">
              {/* Información del cliente */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Cliente</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <strong>Nombre:</strong> {selectedCliente.nombre}
                  </p>
                  <p>
                    <strong>Email:</strong> {selectedCliente.email}
                  </p>
                  <p>
                    <strong>Días sin turno:</strong> {selectedCliente.dias_sin_turno}
                  </p>
                </div>
              </div>

              {/* Oferta */}
              {selectedCliente.servicio_frecuente && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Oferta Especial</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    {selectedCliente.servicio_frecuente.nombre}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-green-700">
                      {formatCurrency(
                        calcularPrecioConDescuento(
                          selectedCliente.servicio_frecuente.precio,
                          data.configuracion.descuento_fidelizacion_pct
                        )
                      )}
                    </span>
                    <span className="text-lg text-gray-500 line-through">
                      {formatCurrency(selectedCliente.servicio_frecuente.precio)}
                    </span>
                    <span className="px-2 py-1 bg-green-600 text-white text-sm font-medium rounded">
                      -{data.configuracion.descuento_fidelizacion_pct}%
                    </span>
                  </div>
                </div>
              )}

              {/* Mensaje personalizado */}
              <div className="space-y-2">
                <Label htmlFor="mensaje">Mensaje Personalizado (Opcional)</Label>
                <Textarea
                  id="mensaje"
                  value={mensajePersonalizado}
                  onChange={(e) => setMensajePersonalizado(e.target.value)}
                  placeholder="Agrega un mensaje personal para el cliente..."
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInvitarDialog(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button onClick={handleEnviarInvitacion} disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Invitación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
