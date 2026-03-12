'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Label } from '@/components/ui/label';
import { getAuthHeaders } from '@/lib/auth-headers';
import { ArrowDownRight, ArrowUpRight, Calendar, DollarSign, Loader2, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ResumenFinanciero {
  total_ingresos: number;
  total_turnos: number;
  turnos_completados: number;
  turnos_cancelados: number;
  turnos_no_asistio: number;
  promedio_por_turno: number;
  tasa_conversion: number;
}

interface IngresoMensual {
  mes: string;
  mes_nombre: string;
  total: number;
  cantidad_turnos: number;
}

interface BalanceTurnos {
  completados: number;
  cancelados: number;
  no_asistio: number;
  pendientes: number;
  confirmados: number;
}

interface ReporteData {
  fecha_desde: string;
  fecha_hasta: string;
  resumen: ResumenFinanciero;
  ingresos_mensuales: IngresoMensual[];
  balance_turnos: BalanceTurnos;
  top_servicios: any[];
  rendimiento_empleados: any[];
}

const COLORS = {
  completados: '#10b981',
  cancelados: '#ef4444',
  no_asistio: '#f59e0b',
  pendientes: '#6b7280',
  confirmados: '#3b82f6',
};

export default function ReportesFinanzasPage() {
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

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
  };

  // Preparar datos para gráfico de torta
  const pieData = data ? [
    { name: 'Completados', value: data.balance_turnos.completados, color: COLORS.completados },
    { name: 'Cancelados', value: data.balance_turnos.cancelados, color: COLORS.cancelados },
    { name: 'No Asistió', value: data.balance_turnos.no_asistio, color: COLORS.no_asistio },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📊 Resumen Financiero</h1>
        <p className="text-gray-600 mt-1">Análisis de ingresos y rendimiento del negocio</p>
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
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* Cards de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(data.resumen.total_ingresos)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">
                    {data.resumen.turnos_completados} turnos completados
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Promedio por Turno</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(data.resumen.promedio_por_turno)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>Ingreso promedio por servicio</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total de Turnos</p>
                    <p className="text-2xl font-bold text-gray-900">{data.resumen.total_turnos}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>En el período seleccionado</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tasa de Conversión</p>
                    <p className="text-2xl font-bold text-gray-900">{data.resumen.tasa_conversion}%</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    {data.resumen.tasa_conversion >= 75 ? (
                      <ArrowUpRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-6 h-6 text-orange-600" />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>Turnos completados / Total</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Ingresos Mensuales */}
            <Card>
              <CardHeader>
                <CardTitle>📈 Ingresos Mensuales</CardTitle>
                <CardDescription>Total recaudado por mes</CardDescription>
              </CardHeader>
              <CardContent>
                {data.ingresos_mensuales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.ingresos_mensuales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="mes"
                        tickFormatter={formatMonth}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        formatter={(value: any) => formatCurrency(value)}
                        labelFormatter={formatMonth}
                      />
                      <Legend />
                      <Bar dataKey="total" fill="#3b82f6" name="Ingresos" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No hay datos de ingresos para mostrar
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Balance de Turnos */}
            <Card>
              <CardHeader>
                <CardTitle>🎯 Balance de Turnos</CardTitle>
                <CardDescription>Distribución de estados</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${value} turnos`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No hay datos de turnos para mostrar
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Servicios */}
          {data.top_servicios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🏆 Servicios Más Rentables</CardTitle>
                <CardDescription>Top 5 servicios por ingresos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.top_servicios.map((servicio, index) => (
                    <div key={servicio.servicio_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{servicio.servicio_nombre}</p>
                          <p className="text-sm text-gray-600">{servicio.cantidad} turnos</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(servicio.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
