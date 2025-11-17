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
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ClienteProfile {
  id: number;
  user: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  fecha_nacimiento?: string;
  direccion?: string;
  preferencias?: string;
  historial_turnos?: any[];
}

export default function PerfilClientePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ClienteProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Estados para el formulario de datos personales
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    fecha_nacimiento: '',
    direccion: '',
    preferencias: '',
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
      // Obtener el cliente asociado al usuario actual
      const response = await authenticatedFetch('/clientes/me/');

      if (response.ok) {
        const data = await response.json();
        console.log('Cliente profile data loaded:', data);
        setProfile(data);
        setFormData({
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          fecha_nacimiento: data.fecha_nacimiento || '',
          direccion: data.direccion || '',
          preferencias: data.preferencias || '',
        });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const response = await authenticatedFetch(`/clientes/${profile?.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
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
    return (first + last).toUpperCase() || 'CL';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No especificada';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
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
              Administra tu información personal y preferencias
            </p>
          </div>
          <Badge variant="outline" className="h-8">
            <User className="w-4 h-4 mr-1" />
            Cliente
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
              <Avatar className="h-24 w-24 bg-linear-to-r from-purple-600 to-pink-600">
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
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Datos Personales</TabsTrigger>
            <TabsTrigger value="historial">Historial de Turnos</TabsTrigger>
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
                  Actualiza tu información personal, contacto y preferencias
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
                      <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="fecha_nacimiento"
                          name="fecha_nacimiento"
                          type="date"
                          value={formData.fecha_nacimiento}
                          onChange={handleInputChange}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="direccion">Dirección</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="direccion"
                          name="direccion"
                          value={formData.direccion}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="Tu dirección"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferencias">Preferencias / Notas</Label>
                    <div className="relative">
                      <Star className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <textarea
                        id="preferencias"
                        name="preferencias"
                        value={formData.preferencias}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        rows={3}
                        placeholder="Tus preferencias o necesidades especiales..."
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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

          {/* Tab: Historial de Turnos */}
          <TabsContent value="historial">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Historial de Turnos
                </CardTitle>
                <CardDescription>
                  Consulta tus turnos anteriores y próximos (solo lectura)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="bg-purple-50 border-purple-200">
                  <AlertCircle className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-800">
                    Tu historial de turnos se muestra en la sección <strong>"Mis Turnos"</strong> del menú principal.
                    Desde allí puedes ver, gestionar y reservar nuevos turnos.
                  </AlertDescription>
                </Alert>

                <div className="mt-6 text-center py-8">
                  <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 mb-4">
                    Ve a la sección de turnos para ver tu historial completo
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/dashboard/cliente/turnos')}
                  >
                    Ir a Mis Turnos
                  </Button>
                </div>
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
                className="bg-linear-to-r from-purple-600 to-pink-600"
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
