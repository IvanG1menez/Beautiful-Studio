'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  Lock,
  Mail,
  Phone,
  Scissors,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface RangoHorario {
  hora_inicio: string;
  hora_fin: string;
}

interface DiaConfig {
  activo: boolean;
  rangos: RangoHorario[];
}

interface HorariosConfig {
  [dia: number]: DiaConfig;
}

interface HorarioEmpleado {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

interface EmpleadoProfile {
  id: number;
  user: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    dni?: string;
  };
  especialidades?: string;
  especialidad_display?: string;
  dias_trabajo?: string;
  horario_entrada?: string;
  horario_salida?: string;
  comision_porcentaje?: number;
  fecha_ingreso?: string;
  is_disponible?: boolean;
  biografia?: string;
  horarios?: string;
}

const DIAS_SEMANA: { [key: number]: string } = {
  0: 'Lunes',
  1: 'Martes',
  2: 'Miércoles',
  3: 'Jueves',
  4: 'Viernes',
  5: 'Sábado',
  6: 'Domingo'
};

export default function PerfilEmpleadoPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<EmpleadoProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Estado de horarios detallados
  const [horarios, setHorarios] = useState<HorariosConfig>({
    0: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    1: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    2: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    3: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    4: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    5: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] },
    6: { activo: false, rangos: [{ hora_inicio: '09:00', hora_fin: '17:00' }] }
  });

  // Estados para el formulario de datos personales
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dni: '',
  });

  // Estados para cambio de contraseña
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadProfile();
  }, [user, router]);

  // Funciones para manejo de horarios
  const toggleDia = (dia: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        activo: !prev[dia].activo,
        rangos: !prev[dia].activo && prev[dia].rangos.length === 0
          ? [{ hora_inicio: '09:00', hora_fin: '17:00' }]
          : prev[dia].rangos
      }
    }));
  };

  const agregarRango = (dia: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        rangos: [...prev[dia].rangos, { hora_inicio: '09:00', hora_fin: '17:00' }]
      }
    }));
  };

  const eliminarRango = (dia: number, index: number) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        rangos: prev[dia].rangos.filter((_, i) => i !== index)
      }
    }));
  };

  const actualizarRango = (dia: number, index: number, field: 'hora_inicio' | 'hora_fin', value: string) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        rangos: prev[dia].rangos.map((r, i) =>
          i === index ? { ...r, [field]: value } : r
        )
      }
    }));
  };

  const getAuthToken = () => localStorage.getItem('auth_token');

  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) throw new Error('No authentication token found');

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    // La URL base ya incluye /api, solo concatenar la URL
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    return fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
        ...options.headers,
      },
    });
  };

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Obtener el empleado asociado al usuario actual
      const response = await authenticatedFetch('/empleados/me/');

      if (response.ok) {
        const data = await response.json();
        console.log('Empleado profile data loaded:', data);
        setProfile(data);
        setFormData({
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          dni: data.user.dni || '',
        });

        // Cargar horarios detallados
        if (data.id) {
          const horariosResponse = await authenticatedFetch(`/empleados/horarios/?empleado=${data.id}`);
          if (horariosResponse.ok) {
            const horariosData = await horariosResponse.json();
            // El backend puede devolver un array directamente o un objeto con paginación
            const horariosArray: HorarioEmpleado[] = Array.isArray(horariosData)
              ? horariosData
              : (horariosData.results || []);

            // Agrupar horarios por día
            const grouped: { [key: number]: RangoHorario[] } = {};
            horariosArray.forEach(h => {
              if (!grouped[h.dia_semana]) {
                grouped[h.dia_semana] = [];
              }
              grouped[h.dia_semana].push({
                hora_inicio: h.hora_inicio,
                hora_fin: h.hora_fin
              });
            });

            // Actualizar estado de horarios
            setHorarios(prev => {
              const updated = { ...prev };
              Object.entries(grouped).forEach(([dia, rangos]) => {
                const diaNum = parseInt(dia);
                updated[diaNum] = {
                  activo: true,
                  rangos: rangos
                };
              });
              return updated;
            });
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', response.status, errorData);
        setError(`Error al cargar el perfil: ${errorData.error || errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setError(`Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await authenticatedFetch(`/empleados/${profile?.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ user: formData }),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setSuccess('✅ Datos actualizados correctamente');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error al actualizar los datos');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Error de conexión al actualizar los datos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsChangingPassword(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await authenticatedFetch('/users/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          old_password: passwordData.current_password,
          new_password: passwordData.new_password,
        }),
      });

      if (response.ok) {
        setSuccess('✅ Contraseña cambiada correctamente');
        setShowPasswordDialog(false);
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Error al cambiar la contraseña');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setError('Error de conexión al cambiar la contraseña');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'PR';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="text-gray-600 mt-1">
              Administra tu información personal y datos profesionales
            </p>
          </div>
          <Badge variant="default" className="h-8 bg-blue-600">
            <Scissors className="w-4 h-4 mr-1" />
            Profesional
          </Badge>
        </div>

        {/* Alertas */}
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Card de Avatar y Info Básica */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-6">
              <Avatar className="h-24 w-24 bg-gradient-to-r from-blue-600 to-cyan-600">
                <AvatarFallback className="text-2xl font-bold text-white">
                  {getInitials(profile?.user.first_name, profile?.user.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.user.first_name} {profile?.user.last_name}
                </h2>
                <p className="text-gray-600">@{profile?.user.username}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline">{profile?.user.email}</Badge>
                  {profile?.user.phone && (
                    <Badge variant="outline">{profile.user.phone}</Badge>
                  )}
                  {profile?.especialidad_display && (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Scissors className="w-3 h-3 mr-1" />
                      {profile.especialidad_display}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Datos Personales</TabsTrigger>
            <TabsTrigger value="profesional">Datos Profesionales</TabsTrigger>
            <TabsTrigger value="credenciales">Credenciales</TabsTrigger>
          </TabsList>

          {/* Tab: Datos Personales */}
          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Datos Personales
                </CardTitle>
                <CardDescription>
                  Actualiza tu nombre, apellido, email y DNI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Nombre</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="first_name"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="Tu nombre"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="last_name">Apellido</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="last_name"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="Tu apellido"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="tu@email.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="+54 9 11 1234-5678"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI</Label>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="dni"
                          name="dni"
                          value={formData.dni}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="12345678"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Datos Profesionales */}
          <TabsContent value="profesional">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Datos Profesionales
                </CardTitle>
                <CardDescription>
                  Información sobre tu especialidad, comisión y horarios de trabajo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Especialidad y Comisión (Solo lectura) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-700">Especialidad</Label>
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Scissors className="w-5 h-5 text-blue-600" />
                      <span className="text-gray-900 font-medium">
                        {profile?.especialidad_display || 'No especificada'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-700">Comisión (%)</Label>
                    <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-gray-900 font-medium">
                        {profile?.comision_porcentaje ? `${profile.comision_porcentaje}%` : 'No definida'}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Días de Trabajo (del modelo Empleado) */}
                {profile?.dias_trabajo && (
                  <div className="space-y-2">
                    <Label className="text-gray-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Días de Trabajo
                    </Label>
                    <div className="flex items-center space-x-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <span className="text-gray-900 font-medium">
                        {profile.dias_trabajo}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 ml-1">
                      Formato: L (Lunes), M (Martes), Mi (Miércoles), J (Jueves), V (Viernes), S (Sábado), D (Domingo)
                    </p>
                  </div>
                )}

                <Separator />

                {/* Horarios Detallados (Solo lectura) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <Label className="text-base font-semibold">Horarios de Trabajo</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Estos son tus horarios de trabajo. Para modificarlos, contacta con tu supervisor.
                  </p>

                  <div className="space-y-3">
                    {Object.entries(DIAS_SEMANA).map(([diaStr, nombre]) => {
                      const dia = parseInt(diaStr);
                      const config = horarios[dia];

                      return (
                        <div
                          key={dia}
                          className={`border rounded-lg p-4 transition-all ${config.activo
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 bg-gray-50'
                            }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-3 h-3 rounded-full ${config.activo ? 'bg-green-500' : 'bg-gray-300'
                              }`} />
                            <span className={`font-semibold ${config.activo ? 'text-gray-900' : 'text-gray-500'
                              }`}>
                              {nombre}
                            </span>
                          </div>

                          {config.activo && config.rangos.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {config.rangos.map((rango, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <Clock className="w-4 h-4 text-primary" />
                                  <span className="font-medium text-gray-700">
                                    {rango.hora_inicio}
                                  </span>
                                  <span className="text-gray-500">hasta</span>
                                  <span className="font-medium text-gray-700">
                                    {rango.hora_fin}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {!config.activo && (
                            <p className="ml-6 text-sm text-gray-500 italic">
                              No trabajas este día
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Los datos profesionales y horarios son administrados por el propietario del estudio.
                    Para modificarlos, contacta con tu supervisor.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Credenciales */}
          <TabsContent value="credenciales">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Credenciales
                </CardTitle>
                <CardDescription>
                  Gestiona tu contraseña y seguridad de la cuenta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowPasswordDialog(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Cambiar Contraseña
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para Cambiar Contraseña */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu contraseña actual y la nueva contraseña
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Contraseña Actual</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="current_password"
                  name="current_password"
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords((prev) => ({ ...prev, current: !prev.current }))
                  }
                  className="absolute right-3 top-3"
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="new_password"
                  name="new_password"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                  }
                  className="absolute right-3 top-3"
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))
                  }
                  className="absolute right-3 top-3"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword}
                className="bg-gradient-to-r from-blue-600 to-cyan-600"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  'Cambiar Contraseña'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
