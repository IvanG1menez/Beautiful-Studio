'use client';

import { BeautifulSpinner } from '@/components/ui/BeautifulSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Label } from '@/components/ui/label';
import { getAuthHeaders } from '@/lib/auth-headers';
import { Calendar, TrendingUp } from 'lucide-react';
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);

      const response = await fetch(
        `/api/turnos/reportes/finanzas/?${params.toString()}`,
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
    <div className="container mx-auto p-6 space-y-6 bg-background">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">📊 Rendimiento de Servicios</h1>
        <p className="text-muted-foreground mt-1">Análisis detallado de servicios y empleados</p>
      </div>

      {/* Filtros de fecha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Rango de Fechas
          </CardTitle>
          <CardDescription>Selecciona el período que deseas analizar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2">
              <Label>Período</Label>
              <DateRangePicker
                align="start"
                locale="es-AR"
                initialDateFrom={fechaDesde || undefined}
                initialDateTo={fechaHasta || undefined}
                onUpdate={({ range }) => {
                  const toStr = (d: Date) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                  };
                  setFechaDesde(toStr(range.from));
                  if (range.to) setFechaHasta(toStr(range.to));
                }}
              />
            </div>
            <Button onClick={fetchData} disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <BeautifulSpinner label="Cargando reportes de servicios..." />
        </div>
      ) : data ? (
        <>
          {/* Gráfico de Top Servicios (más frecuentes y rentables) */}
          {data.top_servicios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🏆 Servicios más frecuentes y rentables</CardTitle>
                <CardDescription>
                  Los servicios con más turnos realizados (frecuencia) y mayor ingreso total en el período.
                </CardDescription>
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
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Servicio</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Cantidad</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ingresos</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_servicios.map((servicio, index) => (
                        <tr key={servicio.servicio_id} className="border-b border-border hover:bg-accent/40">
                          <td className="py-3 px-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                              {index + 1}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {servicio.servicio_nombre}
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">
                            {servicio.cantidad} turnos
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-500">
                            {formatCurrency(servicio.total)}
                          </td>
                          <td className="py-3 px-4 text-right text-muted-foreground">
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
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Empleado</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                          Total Turnos
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                          Completados
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                          Tasa Éxito
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ingresos</th>
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
                          <tr key={empleado.empleado_id} className="border-b border-border hover:bg-accent/40">
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">
                                {empleado.empleado_nombre}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-muted-foreground">
                              {empleado.total_turnos}
                            </td>
                            <td className="py-3 px-4 text-right text-muted-foreground">
                              {empleado.turnos_completados}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <TrendingUp
                                  className={`w-4 h-4 ${parseFloat(tasaExito) >= 80
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
