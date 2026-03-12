'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  TrendingDown,
  User,
  XCircle
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface OfertaDetalles {
  status: string;
  token: string;
  expires_at: string;
  estado?: string; // Para ya_resuelta
  mensaje?: string; // Mensaje adicional
  cliente: {
    nombre: string;
    email: string;
  };
  turno_original: {
    id: number;
    servicio: string;
    fecha_hora: string;
    empleado: string;
    precio: string;
    senia_pagada: string;
  };
  turno_nuevo: {
    id: number;
    servicio: string;
    fecha_hora: string;
    empleado: string;
    precio_total: string;
    descuento: string;
    monto_final: string;
  };
  ahorro: {
    dias_adelantados: number;
    descuento_aplicado: string;
  };
}

export default function ConfirmarReacomodamientoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [oferta, setOferta] = useState<OfertaDetalles | null>(null);
  const [estadoEspecial, setEstadoEspecial] = useState<'ya_resuelta' | 'expirada' | 'invalido' | null>(null);
  const [error, setError] = useState<string>('');
  const [resultado, setResultado] = useState<{
    tipo: 'exito' | 'error';
    mensaje: string;
    accion?: 'aceptada' | 'rechazada';
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token no proporcionado en la URL');
      setLoading(false);
      return;
    }

    cargarOferta();
  }, [token]);

  const cargarOferta = async () => {
    try {
      setLoading(true);
      setError('');
      setEstadoEspecial(null);

      const response = await fetch(`http://localhost:8000/api/turnos/reasignacion/${token}/`);
      const data = await response.json();

      if (response.ok && data.status === 'activa') {
        setOferta(data);
      } else if (response.status === 410) {
        // Oferta ya resuelta o expirada
        if (data.status === 'ya_resuelta') {
          setEstadoEspecial('ya_resuelta');
          setOferta(data); // Guardar data para mostrar el estado
        } else if (data.status === 'expirada') {
          setEstadoEspecial('expirada');
        }
      } else if (response.status === 404) {
        setEstadoEspecial('invalido');
      } else {
        setError(data.error || data.mensaje || 'Error al cargar la oferta');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleRespuesta = async (accion: 'aceptar' | 'rechazar') => {
    if (!token) return;

    setProcesando(true);
    setResultado(null);

    try {
      const response = await fetch(`http://localhost:8000/api/turnos/reasignacion/${token}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accion }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === 'aceptada') {
          setResultado({
            tipo: 'exito',
            mensaje: '¡Perfecto! Tu turno ha sido adelantado exitosamente. Te esperamos en la nueva fecha.',
            accion: 'aceptada',
          });
          // Redirigir después de 5 segundos
          setTimeout(() => {
            router.push('/');
          }, 5000);
        } else if (data.status === 'rechazada') {
          setResultado({
            tipo: 'exito',
            mensaje: 'Tu turno original se mantiene sin cambios. ¡Te esperamos!',
            accion: 'rechazada',
          });
          setTimeout(() => {
            router.push('/');
          }, 5000);
        } else {
          setResultado({
            tipo: 'error',
            mensaje: data.mensaje || 'Respuesta procesada',
          });
        }
      } else {
        if (data.status === 'hueco_no_disponible') {
          setResultado({
            tipo: 'error',
            mensaje: 'Lo sentimos, el turno ya fue tomado por otro cliente.',
          });
        } else if (data.status === 'expirada') {
          setResultado({
            tipo: 'error',
            mensaje: 'Esta oferta ha expirado.',
          });
        } else {
          setResultado({
            tipo: 'error',
            mensaje: data.error || 'Error al procesar la respuesta',
          });
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setResultado({
        tipo: 'error',
        mensaje: 'Error de conexión con el servidor',
      });
    } finally {
      setProcesando(false);
    }
  };

  const formatearFecha = (isoString: string) => {
    const fecha = new Date(isoString);
    return fecha.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatearFechaCorta = (isoString: string) => {
    const fecha = new Date(isoString);
    return fecha.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-lg">Cargando oferta...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pantallas especiales para estados ya resueltos
  if (estadoEspecial === 'ya_resuelta') {
    const estadoFinal = oferta?.estado;
    const esAceptada = estadoFinal === 'aceptada';
    const esRechazada = estadoFinal === 'rechazada';

    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl mb-2">
              {esAceptada && '¡Tu turno ya fue adelantado!'}
              {esRechazada && 'Ya respondiste a esta oferta'}
              {!esAceptada && !esRechazada && 'Esta oferta ya fue procesada'}
            </CardTitle>
            <CardDescription className="text-base">
              {esAceptada && 'Esta oferta ya fue aceptada anteriormente. Tu nuevo turno está confirmado.'}
              {esRechazada && 'Decidiste mantener tu turno original. ¡Te esperamos en la fecha acordada!'}
              {!esAceptada && !esRechazada && 'Esta oferta ya no está disponible para modificaciones.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {esAceptada && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Adelanto confirmado</AlertTitle>
                <AlertDescription className="text-green-700">
                  Ya procesamos tu nuevo turno. Si tienes dudas, comunícate con nosotros.
                </AlertDescription>
              </Alert>
            )}
            {esRechazada && (
              <Alert className="bg-blue-50 border-blue-200">
                <Calendar className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Turno original mantenido</AlertTitle>
                <AlertDescription className="text-blue-700">
                  Tu turno se mantiene en la fecha y horario originalmente acordados.
                </AlertDescription>
              </Alert>
            )}
            <div className="pt-4 flex justify-center">
              <Button onClick={() => router.push('/')} className="w-full sm:w-auto">
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estadoEspecial === 'expirada') {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card className="border-2 border-amber-200">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-10 w-10 text-amber-600" />
            </div>
            <CardTitle className="text-2xl mb-2">Esta oferta ha expirado</CardTitle>
            <CardDescription className="text-base">
              El tiempo límite para responder a esta oferta de adelanto ya venció.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-amber-50 border-amber-200">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Oferta vencida</AlertTitle>
              <AlertDescription className="text-amber-700">
                Las ofertas de adelanto tienen un tiempo limitado de respuesta. Esta oferta ya no está disponible,
                pero tu turno original se mantiene sin cambios.
              </AlertDescription>
            </Alert>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Si deseas cambiar tu turno, puedes comunicarte con nosotros directamente.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Button onClick={() => router.push('/')} className="w-full sm:w-auto">
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estadoEspecial === 'invalido') {
    return (
      <div className="container mx-auto py-12 max-w-2xl">
        <Card className="border-2 border-red-200">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl mb-2">Link no válido</CardTitle>
            <CardDescription className="text-base">
              Este enlace no es válido o no existe en nuestro sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error de validación</AlertTitle>
              <AlertDescription>
                El enlace que intentas acceder no corresponde a ninguna oferta válida.
                Verifica que hayas copiado correctamente la URL completa.
              </AlertDescription>
            </Alert>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Si recibiste este link por email y sigue sin funcionar, contáctanos para asistencia.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Button onClick={() => router.push('/')} variant="outline" className="w-full sm:w-auto">
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !oferta) {
    return (
      <div className="container mx-auto py-12 max-w-4xl">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'No se pudo cargar la oferta'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (resultado) {
    // Pantalla de error
    if (resultado.tipo === 'error') {
      return (
        <div className="container mx-auto py-12 max-w-2xl">
          <Card className="border-2 border-red-200">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <CardTitle className="text-2xl mb-2">No se pudo procesar</CardTitle>
              <CardDescription className="text-base">
                {resultado.mensaje}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Por favor, intenta nuevamente o contáctanos si el problema persiste.
                </AlertDescription>
              </Alert>
              <div className="pt-2 flex justify-center gap-3">
                <Button onClick={() => setResultado(null)} variant="outline">
                  Volver a intentar
                </Button>
                <Button onClick={() => router.push('/')}>
                  Ir al inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Pantalla de turno adelantado aceptado
    if (resultado.accion === 'aceptada' && oferta) {
      return (
        <div className="container mx-auto py-12 max-w-2xl">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-3xl mb-3 text-green-800">
                ¡Turno adelantado confirmado! 🎉
              </CardTitle>
              <CardDescription className="text-base text-green-700">
                Excelente decisión. Tu nuevo turno está confirmado y te ahorraste tiempo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Información del nuevo turno */}
              <div className="bg-white rounded-lg border-2 border-green-200 p-5 space-y-3">
                <h3 className="font-semibold text-lg text-green-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tu nuevo turno
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Servicio:</span>
                    <span className="font-semibold">{oferta.turno_nuevo.servicio}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Fecha y hora:</span>
                    <span className="font-semibold">{formatearFechaCorta(oferta.turno_nuevo.fecha_hora)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Profesional:</span>
                    <span className="font-semibold">{oferta.turno_nuevo.empleado}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Monto a pagar:</span>
                    <span className="font-bold text-green-600 text-lg">${oferta.turno_nuevo.monto_final}</span>
                  </div>
                </div>
              </div>

              {/* Beneficios */}
              <Alert className="bg-green-50 border-green-200">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">¡Excelente ahorro!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Te adelantaste <strong>{oferta.ahorro.dias_adelantados} días</strong> y tu turno original
                  quedó libre para otro cliente.
                  {oferta.ahorro.descuento_aplicado !== '0' && oferta.ahorro.descuento_aplicado !== '0.00' && (
                    <> Además, ahorraste <strong>${oferta.ahorro.descuento_aplicado}</strong>.</>
                  )}
                </AlertDescription>
              </Alert>

              {/* Próximos pasos */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recordá
                </h4>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Te enviamos un email de confirmación a {oferta.cliente.email}</li>
                  <li>Recordá el día y horario de tu nuevo turno</li>
                  <li>Si necesitás cancelar o reprogramar, avisanos con anticipación</li>
                </ul>
              </div>

              <div className="pt-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Serás redirigido al inicio en 5 segundos...
                </p>
                <Button onClick={() => router.push('/')} size="lg" className="w-full sm:w-auto">
                  Volver al inicio ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Pantalla de turno mantenido (rechazado)
    if (resultado.accion === 'rechazada' && oferta) {
      return (
        <div className="container mx-auto py-12 max-w-2xl">
          <Card className="border-2 border-blue-200">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-10 w-10 text-blue-600" />
              </div>
              <CardTitle className="text-2xl mb-2 text-blue-800">
                Turno original mantenido
              </CardTitle>
              <CardDescription className="text-base">
                Perfecto, tu turno se mantiene en la fecha y horario originales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Información del turno mantenido */}
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-5 space-y-3">
                <h3 className="font-semibold text-lg text-blue-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Tu turno confirmado
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-blue-100">
                    <span className="text-muted-foreground">Servicio:</span>
                    <span className="font-semibold">{oferta.turno_original.servicio}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-blue-100">
                    <span className="text-muted-foreground">Fecha y hora:</span>
                    <span className="font-semibold">{formatearFechaCorta(oferta.turno_original.fecha_hora)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-blue-100">
                    <span className="text-muted-foreground">Profesional:</span>
                    <span className="font-semibold">{oferta.turno_original.empleado}</span>
                  </div>
                </div>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Todo en orden</AlertTitle>
                <AlertDescription className="text-blue-700">
                  Tu turno se mantiene sin cambios. ¡Te esperamos en la fecha acordada!
                </AlertDescription>
              </Alert>

              <div className="pt-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Serás redirigido al inicio en 5 segundos...
                </p>
                <Button onClick={() => router.push('/')} size="lg" className="w-full sm:w-auto">
                  Volver al inicio ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Fallback para otros casos
    return (
      <div className="container mx-auto py-12 max-w-4xl">
        <Alert variant="default">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>¡Listo!</AlertTitle>
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const expiresAt = new Date(oferta.expires_at);
  const horasRestantes = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
  const minutosRestantes = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60)) % 60);

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-center mb-2">¡Tenemos una fecha mejor para ti!</h1>
        <p className="text-center text-muted-foreground">
          Se liberó un turno antes de tu fecha actual y queremos ofrecértelo con un descuento especial
        </p>
      </div>

      {/* Alerta de expiración */}
      <Alert className="mb-6">
        <Clock className="h-4 w-4" />
        <AlertTitle>Tiempo limitado</AlertTitle>
        <AlertDescription>
          Esta oferta expira en <strong>{horasRestantes}h {minutosRestantes}min</strong> ({formatearFechaCorta(oferta.expires_at)})
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Turno Original */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tu turno actual
            </CardTitle>
            <CardDescription>El que solicitaste originalmente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Fecha y hora</p>
                <p className="text-sm text-muted-foreground">{formatearFecha(oferta.turno_original.fecha_hora)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Profesional</p>
                <p className="text-sm text-muted-foreground">{oferta.turno_original.empleado}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Servicio</p>
                <p className="text-sm text-muted-foreground">{oferta.turno_original.servicio}</p>
                <p className="text-sm text-muted-foreground">Precio: ${oferta.turno_original.precio}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Turno Nuevo */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <TrendingDown className="h-5 w-5" />
              Nuevo turno disponible
            </CardTitle>
            <CardDescription>¡Con descuento especial!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary">Nueva fecha y hora</p>
                <p className="text-sm font-semibold">{formatearFecha(oferta.turno_nuevo.fecha_hora)}</p>
                {oferta.ahorro.dias_adelantados > 0 && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    ¡{oferta.ahorro.dias_adelantados} días antes!
                  </p>
                )}
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Profesional</p>
                <p className="text-sm text-muted-foreground">{oferta.turno_nuevo.empleado}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Servicio</p>
                <p className="text-sm text-muted-foreground">{oferta.turno_nuevo.servicio}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desglose de Precios */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Desglose de precios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio del servicio</span>
              <span className="font-medium">${oferta.turno_nuevo.precio_total}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Descuento especial por adelanto</span>
              <span className="font-medium">-${oferta.turno_nuevo.descuento}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seña ya pagada</span>
              <span className="font-medium">-${oferta.turno_original.senia_pagada}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Monto final a pagar</span>
              <span className="text-primary">${oferta.turno_nuevo.monto_final}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información del Cliente */}
      <Alert className="mb-6">
        <User className="h-4 w-4" />
        <AlertTitle>Confirmando para</AlertTitle>
        <AlertDescription>
          {oferta.cliente.nombre} ({oferta.cliente.email})
        </AlertDescription>
      </Alert>

      {/* Botones de Acción */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={() => handleRespuesta('aceptar')}
          disabled={procesando}
          size="lg"
          className="h-14 text-lg"
        >
          {procesando ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Aceptar adelanto
            </>
          )}
        </Button>

        <Button
          onClick={() => handleRespuesta('rechazar')}
          disabled={procesando}
          variant="outline"
          size="lg"
          className="h-14 text-lg"
        >
          {procesando ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-5 w-5" />
              Mantener turno original
            </>
          )}
        </Button>
      </div>

      {/* Nota al pie */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        Si tienes dudas, puedes comunicarte con nosotros antes de tomar una decisión.
        <br />
        Esta oferta es personal y no puede ser transferida.
      </p>
    </div>
  );
}
