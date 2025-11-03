'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Edit,
  Eye,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  UserCircle,
  UserPlus,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Cliente {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    dni: string;
  };
  nombre_completo: string;
  email: string;
  telefono: string;
  fecha_nacimiento: string | null;
  direccion: string;
  is_vip: boolean;
  fecha_primera_visita: string;
  created_at: string;
}

interface Empleado {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    dni: string;
  };
  nombre_completo: string;
  email: string;
  especialidades: string;
  especialidad_display: string;
  is_disponible: boolean;
  fecha_ingreso: string;
  horario_entrada: string;
  horario_salida: string;
  dias_trabajo: string;
  created_at: string;
}

export default function UsuariosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [searchClientes, setSearchClientes] = useState('');
  const [searchEmpleados, setSearchEmpleados] = useState('');
  const [activeTab, setActiveTab] = useState('clientes');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  // Verificar autenticación al montar
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('No authentication token found, redirecting to login');
      router.push('/login');
      return;
    }
    setIsAuthenticated(true);
  }, [router]);

  const getAuthToken = (): string | null => {
    return localStorage.getItem('auth_token');
  };

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) {
      console.error('No token available for request');
      router.push('/login');
      throw new Error('No authentication token found');
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    // La URL base ya incluye /api, no agregar nuevamente
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    console.log('Making authenticated request to:', fullUrl);

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}`,
    };

    return fetch(fullUrl, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadClientes();
      loadEmpleados();
    }
  }, [isAuthenticated]);

  const loadClientes = async () => {
    setLoadingClientes(true);
    try {
      console.log('Loading clientes...');
      const response = await authenticatedFetch('/clientes/?page_size=100');
      console.log('Clientes response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Clientes data:', data);
        setClientes(data.results || []);
      } else {
        console.error('Error response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading clientes:', error);
    } finally {
      setLoadingClientes(false);
    }
  };

  const loadEmpleados = async () => {
    setLoadingEmpleados(true);
    try {
      console.log('Loading empleados...');
      const response = await authenticatedFetch('/empleados/?page_size=100');
      console.log('Empleados response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Empleados data:', data);
        setEmpleados(data.results || []);
      } else {
        console.error('Error response:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading empleados:', error);
    } finally {
      setLoadingEmpleados(false);
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nombre_completo.toLowerCase().includes(searchClientes.toLowerCase()) ||
    cliente.email.toLowerCase().includes(searchClientes.toLowerCase()) ||
    cliente.user?.dni?.toLowerCase().includes(searchClientes.toLowerCase())
  );

  const filteredEmpleados = empleados.filter(empleado =>
    empleado.nombre_completo.toLowerCase().includes(searchEmpleados.toLowerCase()) ||
    empleado.email.toLowerCase().includes(searchEmpleados.toLowerCase()) ||
    empleado.especialidad_display.toLowerCase().includes(searchEmpleados.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Mostrar loading mientras verifica autenticación
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/dashboard-propietario')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestión de Usuarios
                </h1>
                <p className="text-gray-600">
                  Administra clientes y profesionales
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-between items-center">
            <TabsList className="grid w-auto grid-cols-2">
              <TabsTrigger value="clientes" className="flex items-center space-x-2">
                <UserCircle className="w-4 h-4" />
                <span>Clientes ({clientes.length})</span>
              </TabsTrigger>
              <TabsTrigger value="profesionales" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Profesionales ({empleados.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab: Clientes */}
          <TabsContent value="clientes" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Clientes</CardTitle>
                    <CardDescription>
                      {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} registrado{filteredClientes.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Buscar clientes..."
                        value={searchClientes}
                        onChange={(e) => setSearchClientes(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button
                      onClick={() => router.push('/dashboard-propietario/clientes/nuevo')}
                      className="bg-gradient-to-r from-blue-600 to-purple-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Cliente
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingClientes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600">Cargando clientes...</span>
                  </div>
                ) : filteredClientes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Cliente</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Contacto</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">DNI</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Estado</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Primera Visita</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClientes.map((cliente) => (
                          <tr key={cliente.id} className="border-b hover:bg-gray-50">
                            <td className="py-4 px-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                  {cliente.nombre_completo.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {cliente.nombre_completo}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    @{cliente.user?.username}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center text-sm text-gray-600">
                                  <Mail className="w-3 h-3 mr-1" />
                                  {cliente.email}
                                </div>
                                {cliente.telefono && (
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {cliente.telefono}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-600">
                                {cliente.user?.dni || '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              {cliente.is_vip ? (
                                <Badge className="bg-yellow-500">VIP</Badge>
                              ) : (
                                <Badge variant="secondary">Regular</Badge>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-600">
                                {formatDate(cliente.fecha_primera_visita)}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/dashboard-propietario/clientes/${cliente.id}`)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => router.push(`/dashboard-propietario/clientes/${cliente.id}/editar`)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">
                      {searchClientes ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    </p>
                    {!searchClientes && (
                      <Button
                        onClick={() => router.push('/dashboard-propietario/clientes/nuevo')}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar primer cliente
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Profesionales */}
          <TabsContent value="profesionales" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Profesionales</CardTitle>
                    <CardDescription>
                      {filteredEmpleados.length} profesional{filteredEmpleados.length !== 1 ? 'es' : ''} en el equipo
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Buscar profesionales..."
                        value={searchEmpleados}
                        onChange={(e) => setSearchEmpleados(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button
                      onClick={() => router.push('/dashboard-propietario/profesionales/nuevo')}
                      className="bg-gradient-to-r from-purple-600 to-blue-600"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Nuevo Profesional
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEmpleados ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-600">Cargando profesionales...</span>
                  </div>
                ) : filteredEmpleados.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEmpleados.map((empleado) => (
                      <Card key={empleado.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                                {empleado.nombre_completo.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <CardTitle className="text-base">
                                  {empleado.nombre_completo}
                                </CardTitle>
                                <p className="text-sm text-gray-500">
                                  {empleado.especialidad_display}
                                </p>
                              </div>
                            </div>
                            <Badge variant={empleado.is_disponible ? 'default' : 'secondary'}>
                              {empleado.is_disponible ? 'Disponible' : 'No disponible'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-3 h-3 mr-2" />
                            {empleado.email}
                          </div>
                          {empleado.user?.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="w-3 h-3 mr-2" />
                              {empleado.user.phone}
                            </div>
                          )}
                          <div className="text-sm text-gray-600 pt-2 border-t">
                            <div className="flex justify-between">
                              <span>Horario:</span>
                              <span className="font-medium">
                                {empleado.horario_entrada?.slice(0, 5)} - {empleado.horario_salida?.slice(0, 5)}
                              </span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>Días:</span>
                              <span className="font-medium">{empleado.dias_trabajo}</span>
                            </div>
                          </div>
                          <div className="flex space-x-2 pt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => router.push(`/dashboard-propietario/profesionales/${empleado.id}`)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => router.push(`/dashboard-propietario/profesionales/${empleado.id}/editar`)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">
                      {searchEmpleados ? 'No se encontraron profesionales' : 'No hay profesionales registrados'}
                    </p>
                    {!searchEmpleados && (
                      <Button
                        onClick={() => router.push('/dashboard-propietario/profesionales/nuevo')}
                        variant="outline"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Agregar primer profesional
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
