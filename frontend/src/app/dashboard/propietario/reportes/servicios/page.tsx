'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Loader2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ReporteData {
  fecha_desde: string;
  fecha_hasta: string;
  top_servicios: {
    servicio_id: number;
    servicio_nombre: string;
    total: number;
    cantidad: number;
  }[];
  rendimiento_empleados: {
    empleado_id: number;
    empleado_nombre: string;
    total_turnos: number;
    turnos_completados: number;
    total_ingresos: number;
  }[];
}

export default function ReportesServiciosPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReporteData | null>(null);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Token ${token}` : '',
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);

      const response = await fetch(
        `http://localhost:8000/api/turnos/reportes/finanzas/?${params.toString()}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Configurar fechas por defecto: últimos 6 meses
    const hoy = new Date();
    const seismesesAtras = new Date();
    seismesesAtras.setMonth(seismesesAtras.getMonth() - 6);

    setFechaHasta(hoy.toISOString().split('T')[0]);
    setFechaDesde(seismesesAtras.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      fetchData();
    }
  }, [fechaDesde, fechaHasta]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📊 Rendimiento de Servicios</h1>
        <p className="text-gray-600 mt-1">Análisis detallado de servicios y empleados</p>
      </div>

      {/* Filtros de fecha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Rango de Fechas
          </CardTitle>
          <CardDescription>Selecciona el período que deseas analizar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fecha_desde">Desde</Label>
              <Input
                id="fecha_desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fecha_hasta">Hasta</Label>
              <Input
                id="fecha_hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchData} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  'Actualizar'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* Gráfico de Top Servicios */}
          {data.top_servicios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🏆 Top Servicios por Ingresos</CardTitle>
                <CardDescription>Los 5 servicios más rentables del período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={data.top_servicios}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                    <YAxis type="category" dataKey="servicio_nombre" width={90} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="total" fill="#8b5cf6" name="Ingresos" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabla detallada de servicios */}
          {data.top_servicios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📋 Detalle de Servicios</CardTitle>
                <CardDescription>Información completa de cada servicio</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">#</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Servicio</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Cantidad</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Ingresos</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_servicios.map((servicio, index) => (
                        <tr key={servicio.servicio_id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
                              {index + 1}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {servicio.servicio_nombre}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {servicio.cantidad} turnos
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-600">
                            {formatCurrency(servicio.total)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            {formatCurrency(servicio.total / servicio.cantidad)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rendimiento de Empleados */}
          {data.rendimiento_empleados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>👥 Rendimiento de Empleados</CardTitle>
                <CardDescription>Estadísticas de cada profesional</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Empleado</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">
                          Total Turnos
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">
                          Completados
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">
                          Tasa Éxito
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rendimiento_empleados.map((empleado) => {
                        const tasaExito =
                          empleado.total_turnos > 0
                            ? ((empleado.turnos_completados / empleado.total_turnos) * 100).toFixed(
                                1
                              )
                            : '0';
                        return (
                          <tr key={empleado.empleado_id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">
                                {empleado.empleado_nombre}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {empleado.total_turnos}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {empleado.turnos_completados}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <TrendingUp
                                  className={`w-4 h-4 ${
                                    parseFloat(tasaExito) >= 80
                                      ? 'text-green-600'
                                      : 'text-orange-600'
                                  }`}
                                />
                                <span
                                  className={
                                    parseFloat(tasaExito) >= 80
                                      ? 'text-green-600 font-medium'
                                      : 'text-orange-600 font-medium'
                                  }
                                >
                                  {tasaExito}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-green-600">
                              {formatCurrency(empleado.total_ingresos)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {data.top_servicios.length === 0 && data.rendimiento_empleados.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay datos disponibles para el período seleccionado
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
