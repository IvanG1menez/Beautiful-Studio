'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Turno {
  id: number;
  cliente_nombre: string;
  servicio_nombre: string;
  fecha_hora: string;
  estado: string;
  estado_display: string;
  precio_final: number;
}

interface CompletarTurnosMasivoProps {
  onTurnosCompletados?: () => void;
}

export default function CompletarTurnosMasivo({ onTurnosCompletados }: CompletarTurnosMasivoProps) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [turnosSeleccionados, setTurnosSeleccionados] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompletando, setIsCompletando] = useState(false);

  // Función para buscar turnos en el rango de fechas
  const buscarTurnos = async () => {
    if (!fechaDesde || !fechaHasta) {
      toast.error('Debe seleccionar ambas fechas');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.get('/turnos/pendientes-rango/', {
        params: {
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        },
      });

      setTurnos(response.data.turnos || []);
      setTurnosSeleccionados([]);

      if (response.data.total === 0) {
        toast.info('No se encontraron turnos pendientes en este rango');
      } else {
        toast.success(`Se encontraron ${response.data.total} turnos`);
      }
    } catch (error) {
      console.error('Error al buscar turnos:', error);
      toast.error('Error al buscar turnos');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para marcar turnos como completados
  const completarTurnos = async (usarSeleccionados: boolean = true) => {
    if (usarSeleccionados && turnosSeleccionados.length === 0) {
      toast.error('Debe seleccionar al menos un turno');
      return;
    }

    setIsCompletando(true);
    try {
      let response;

      if (usarSeleccionados) {
        // Completar solo los seleccionados
        response = await api.post('/turnos/completar-masivo/', {
          turno_ids: turnosSeleccionados,
        });
      } else {
        // Completar todos en el rango de fechas
        response = await api.post('/turnos/completar-masivo/', {
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        });
      }

      const { completados, total_seleccionados, errores } = response.data;

      if (completados > 0) {
        toast.success(`✓ ${completados} turno(s) marcado(s) como completados`);

        // Limpiar selección y refrescar
        setTurnosSeleccionados([]);
        buscarTurnos();

        // Callback para refrescar lista principal
        if (onTurnosCompletados) {
          onTurnosCompletados();
        }
      }

      if (errores && errores.length > 0) {
        toast.error(`${errores.length} error(es) al completar algunos turnos`);
      }

      if (completados === 0) {
        toast.info('No se completaron turnos');
      }
    } catch (error) {
      console.error('Error al completar turnos:', error);
      toast.error('Error al completar turnos');
    } finally {
      setIsCompletando(false);
    }
  };

  // Función para completar turnos de la última semana
  const completarUltimaSemana = async () => {
    setIsCompletando(true);
    try {
      const response = await api.post('/turnos/completar-ultima-semana/');
      const { completados, total_encontrados } = response.data;

      if (completados > 0) {
        toast.success(`✓ ${completados} turno(s) de la última semana marcados como completados`);

        // Refrescar si hay fechas seleccionadas
        if (fechaDesde && fechaHasta) {
          buscarTurnos();
        }

        if (onTurnosCompletados) {
          onTurnosCompletados();
        }
      } else {
        toast.info('No hay turnos pendientes en la última semana');
      }
    } catch (error) {
      console.error('Error al completar turnos:', error);
      toast.error('Error al completar turnos de la última semana');
    } finally {
      setIsCompletando(false);
    }
  };

  // Toggle selección de turno
  const toggleTurno = (turnoId: number) => {
    setTurnosSeleccionados(prev => {
      if (prev.includes(turnoId)) {
        return prev.filter(id => id !== turnoId);
      } else {
        return [...prev, turnoId];
      }
    });
  };

  // Seleccionar todos los turnos
  const seleccionarTodos = () => {
    if (turnosSeleccionados.length === turnos.length) {
      setTurnosSeleccionados([]);
    } else {
      setTurnosSeleccionados(turnos.map(t => t.id));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Completar Turnos Masivamente</CardTitle>
          <CardDescription>
            Selecciona un rango de fechas para buscar turnos pendientes y marcarlos como completados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtro de rango de fechas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha-desde">Fecha Desde</Label>
              <Input
                id="fecha-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha-hasta">Fecha Hasta</Label>
              <Input
                id="fecha-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={buscarTurnos}
                disabled={isLoading || !fechaDesde || !fechaHasta}
                className="w-full"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {isLoading ? 'Buscando...' : 'Buscar Turnos'}
              </Button>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={completarUltimaSemana}
              disabled={isCompletando}
            >
              Completar Última Semana
            </Button>

            {turnos.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => completarTurnos(false)}
                  disabled={isCompletando || !fechaDesde || !fechaHasta}
                >
                  Completar Todos del Rango
                </Button>

                <Button
                  onClick={() => completarTurnos(true)}
                  disabled={isCompletando || turnosSeleccionados.length === 0}
                >
                  Completar Seleccionados ({turnosSeleccionados.length})
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de turnos */}
      {turnos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Turnos Encontrados ({turnos.length})</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="select-all"
                checked={turnosSeleccionados.length === turnos.length && turnos.length > 0}
                onCheckedChange={seleccionarTodos}
              />
              <Label htmlFor="select-all" className="cursor-pointer">
                Seleccionar todos
              </Label>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {turnos.map((turno) => (
                <div
                  key={turno.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors ${turnosSeleccionados.includes(turno.id) ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                >
                  <Checkbox
                    id={`turno-${turno.id}`}
                    checked={turnosSeleccionados.includes(turno.id)}
                    onCheckedChange={() => toggleTurno(turno.id)}
                  />

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <p className="font-semibold text-sm">{turno.cliente_nombre}</p>
                      <p className="text-xs text-gray-600">{turno.servicio_nombre}</p>
                    </div>

                    <div>
                      <p className="text-sm">
                        {format(new Date(turno.fecha_hora), "dd/MM/yyyy", { locale: es })}
                      </p>
                      <p className="text-xs text-gray-600">
                        {format(new Date(turno.fecha_hora), "HH:mm", { locale: es })} hs
                      </p>
                    </div>

                    <div>
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${turno.estado === 'confirmado' ? 'bg-green-100 text-green-800' :
                          turno.estado === 'en_proceso' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {turno.estado_display}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-sm">${turno.precio_final}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
