'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, Calendar, Loader2, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MovimientoBilletera {
  id: number;
  cliente_nombre: string;
  tipo_movimiento: string;
  monto: number;
  descripcion: string;
  fecha_creacion: string;
}

interface ResumenBilletera {
  total_creditos: number;
  total_debitos: number;
  saldo_total_sistema: number;
  billeteras_activas: number;
  total_movimientos: number;
}

interface ReporteData {
  resumen: ResumenBilletera;
  movimientos_recientes: MovimientoBilletera[];
}

export default function ReportesBilleteraPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReporteData | null>(null);

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
      const response = await fetch(`http://localhost:8000/api/turnos/reportes/billetera/`, {
        headers: getAuthHeaders(),
      });

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
    fetchData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTipoMovimientoLabel = (tipo: string) => {
    const tipos: Record<string, string> = {
      cancelacion: '❌ Cancelación',
      ajuste_manual: '⚙️ Ajuste Manual',
      debito_sena: '💵 Débito Seña',
      credito_admin: '➕ Crédito Admin',
    };
    return tipos[tipo] || tipo;
  };

  const getTipoColor = (tipo: string) => {
    if (tipo === 'cancelacion' || tipo === 'credito_admin') {
      return 'text-green-600 bg-green-50';
    }
    if (tipo === 'debito_sena') {
      return 'text-red-600 bg-red-50';
    }
    return 'text-blue-600 bg-blue-50';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">💰 Auditoría de Billetera</h1>
        <p className="text-gray-600 mt-1">
          Seguimiento completo de créditos y saldos del sistema
        </p>
      </div>

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
                    <p className="text-sm text-gray-600">Total Créditos</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(data.resumen.total_creditos)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>Saldo agregado a favor clientes</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Débitos</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(data.resumen.total_debitos)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <ArrowDownRight className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>Saldo utilizado en servicios</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Saldo Total Sistema</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(data.resumen.saldo_total_sistema)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>Suma de todas las billeteras</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Billeteras Activas</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {data.resumen.billeteras_activas}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span>Clientes con saldo &gt; 0</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Métricas adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>📊 Balance General</CardTitle>
                <CardDescription>Diferencia entre créditos y débitos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Créditos:</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(data.resumen.total_creditos)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Débitos:</span>
                    <span className="text-lg font-bold text-red-600">
                      -{formatCurrency(data.resumen.total_debitos)}
                    </span>
                  </div>
                  <div className="border-t pt-4 flex justify-between items-center">
                    <span className="text-gray-900 font-medium">Saldo Neto:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency(
                        data.resumen.total_creditos - data.resumen.total_debitos
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📈 Estadísticas</CardTitle>
                <CardDescription>Métricas del sistema de billetera</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total de Movimientos:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {data.resumen.total_movimientos}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Promedio por Billetera:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {data.resumen.billeteras_activas > 0
                        ? formatCurrency(
                            data.resumen.saldo_total_sistema / data.resumen.billeteras_activas
                          )
                        : '$0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tasa de Uso:</span>
                    <span className="text-lg font-bold text-gray-900">
                      {data.resumen.total_creditos > 0
                        ? (
                            (data.resumen.total_debitos / data.resumen.total_creditos) *
                            100
                          ).toFixed(1)
                        : '0'}
                      %
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Movimientos Recientes */}
          {data.movimientos_recientes && data.movimientos_recientes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>🕒 Movimientos Recientes</CardTitle>
                    <CardDescription>Últimas 50 transacciones del sistema</CardDescription>
                  </div>
                  <Button onClick={fetchData} variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Fecha</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Cliente</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Tipo</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Descripción
                        </th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movimientos_recientes.map((movimiento) => (
                        <tr key={movimiento.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {formatDate(movimiento.fecha_creacion)}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {movimiento.cliente_nombre}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoColor(movimiento.tipo_movimiento)}`}
                            >
                              {getTipoMovimientoLabel(movimiento.tipo_movimiento)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {movimiento.descripcion}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              movimiento.tipo_movimiento === 'cancelacion' ||
                              movimiento.tipo_movimiento === 'credito_admin'
                                ? 'text-green-600'
                                : 'text-red-600'
                            }`}
                          >
                            {movimiento.tipo_movimiento === 'cancelacion' ||
                            movimiento.tipo_movimiento === 'credito_admin'
                              ? '+'
                              : '-'}
                            {formatCurrency(Math.abs(movimiento.monto))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
