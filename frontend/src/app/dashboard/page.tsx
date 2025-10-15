'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CalendarDays, 
  Users, 
  Scissors, 
  DollarSign,
  TrendingUp,
  Clock,
  User,
  CheckCircle
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  // Estadísticas mock - en una aplicación real vendrían de la API
  const stats = {
    turnosHoy: 12,
    clientesTotal: 156,
    serviciosActivos: 24,
    ingresosMes: 15420,
    turnosPendientes: 8,
    turnosCompletados: 45,
    empleadosDisponibles: 6,
    promedioEspera: 15 // minutos
  };

  const turnosHoy = [
    {
      id: 1,
      cliente: 'María González',
      servicio: 'Corte y Color',
      hora: '09:30',
      empleado: 'Ana López',
      estado: 'confirmado'
    },
    {
      id: 2,
      cliente: 'Carmen Rodríguez',
      servicio: 'Manicura',
      hora: '10:15',
      empleado: 'Laura Martín',
      estado: 'en_proceso'
    },
    {
      id: 3,
      cliente: 'Isabel Moreno',
      servicio: 'Tratamiento Facial',
      hora: '11:00',
      empleado: 'Sofia Chen',
      estado: 'pendiente'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado': return 'bg-blue-100 text-blue-800';
      case 'en_proceso': return 'bg-yellow-100 text-yellow-800';
      case 'pendiente': return 'bg-gray-100 text-gray-800';
      case 'completado': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmado': return 'Confirmado';
      case 'en_proceso': return 'En Proceso';
      case 'pendiente': return 'Pendiente';
      case 'completado': return 'Completado';
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              ¡Hola, {user?.first_name || user?.username}! 👋
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Aquí tienes un resumen de tu día
            </p>
          </div>

          {/* Estadísticas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Turnos Hoy</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.turnosHoy}</div>
                <p className="text-xs text-muted-foreground">
                  +2 desde ayer
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Total</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.clientesTotal}</div>
                <p className="text-xs text-muted-foreground">
                  +12% este mes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Servicios Activos</CardTitle>
                <Scissors className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.serviciosActivos}</div>
                <p className="text-xs text-muted-foreground">
                  En 6 categorías
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.ingresosMes.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +8% vs mes anterior
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Turnos de hoy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CalendarDays className="mr-2 h-5 w-5" />
                  Turnos de Hoy
                </CardTitle>
                <CardDescription>
                  Próximas citas programadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {turnosHoy.map((turno) => (
                    <div key={turno.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm">{turno.cliente}</h4>
                          <Badge className={getStatusColor(turno.estado)}>
                            {getStatusText(turno.estado)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{turno.servicio}</p>
                        <p className="text-xs text-gray-500">
                          {turno.hora} • {turno.empleado}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Métricas rápidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Métricas Rápidas
                </CardTitle>
                <CardDescription>
                  Estado actual del salón
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm">Turnos Pendientes</span>
                    </div>
                    <span className="font-medium">{stats.turnosPendientes}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm">Completados Hoy</span>
                    </div>
                    <span className="font-medium">{stats.turnosCompletados}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-blue-500 mr-2" />
                      <span className="text-sm">Empleados Disponibles</span>
                    </div>
                    <span className="font-medium">{stats.empleadosDisponibles}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-orange-500 mr-2" />
                      <span className="text-sm">Tiempo Promedio Espera</span>
                    </div>
                    <span className="font-medium">{stats.promedioEspera}min</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}