'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Info, Loader2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';

interface LogEntry {
  paso: number;
  accion: string;
  resultado: 'exitoso' | 'no_aplica' | 'error';
  detalle: string;
}

interface ResultadoOptimizacion {
  turno_id: number;
  turno_info: {
    servicio: string;
    cliente: string;
    empleado: string;
    fecha_hora: string;
    precio: number;
  };
  logs: LogEntry[];
  credito_aplicado: boolean;
  monto_credito: number;
  proceso_2?: {
    status: string;
    turno_candidato_id?: number;
    cliente_contactado?: string;
    motivo?: string;
  };
}

interface ResultadoSimulacion {
  turno_id: number;
  log_id: number;
  logs: LogEntry[];
  siguiente_candidato?: {
    turno_id: number;
    cliente: string;
    log_id: number;
  } | null;
}

interface ClienteCandidato {
  cliente_id: number;
  nombre: string;
  email: string;
  dias_sin_turno: number;
  umbral_usado: number;
  saldo_billetera?: number;
  tiene_saldo?: boolean;
  servicio_propuesto?: {
    id: number;
    nombre: string;
    precio_original: number;
    precio_con_descuento: number;
  };
  email_enviado: boolean;
  email_status: 'exitoso' | 'error' | 'simulado';
  email_error?: string;
}

interface ResultadoFidelizacion {
  mensaje: string;
  configuracion: {
    dias_inactividad_filtro: number | null;
    usa_filtro_manual: boolean;
    margen_global: number;
    descuento_fidelizacion_pct: number;
    enviar_emails: boolean;
  };
  resumen: {
    total_candidatos: number;
    emails_enviados: number;
    emails_fallidos: number;
    emails_simulados: number;
  };
  resultados: ClienteCandidato[];
}

export default function DiagnosticoPage() {
  const [loadingOptimizacion, setLoadingOptimizacion] = useState(false);
  const [loadingFidelizacion, setLoadingFidelizacion] = useState(false);
  const [loadingSimulacion, setLoadingSimulacion] = useState(false);

  // Estado para Optimización
  const [turnoId, setTurnoId] = useState('');
  const [resultadoOptimizacion, setResultadoOptimizacion] = useState<ResultadoOptimizacion | null>(null);
  const [errorOptimizacion, setErrorOptimizacion] = useState<string>('');

  // Estado para Simulación de No Respuesta
  const [resultadoSimulacion, setResultadoSimulacion] = useState<ResultadoSimulacion | null>(null);
  const [errorSimulacion, setErrorSimulacion] = useState<string>('');

  // Estado para Fidelización
  const [diasInactividad, setDiasInactividad] = useState('');
  const [resultadoFidelizacion, setResultadoFidelizacion] = useState<ResultadoFidelizacion | null>(null);
  const [errorFidelizacion, setErrorFidelizacion] = useState<string>('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Token ${token}` : '',
    };
  };

  const handleOptimizacion = async () => {
    if (!turnoId) {
      setErrorOptimizacion('Por favor ingresa un ID de turno');
      return;
    }

    setLoadingOptimizacion(true);
    setErrorOptimizacion('');
    setResultadoOptimizacion(null);
    setResultadoSimulacion(null); // Limpiar simulación anterior
    setErrorSimulacion('');

    try {
      const response = await fetch('/api/turnos/diagnostico/optimizacion-agenda/', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ turno_id: parseInt(turnoId) }),
      });

      const data = await response.json();

      if (response.ok) {
        setResultadoOptimizacion(data);
      } else {
        setErrorOptimizacion(data.error || 'Error al ejecutar optimización');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorOptimizacion('Error de conexión con el servidor');
    } finally {
      setLoadingOptimizacion(false);
    }
  };

  const handleSimularNoRespuesta = async () => {
    if (!resultadoOptimizacion?.proceso_2?.turno_candidato_id) {
      setErrorSimulacion('No hay turno candidato para simular');
      return;
    }

    setLoadingSimulacion(true);
    setErrorSimulacion('');
    setResultadoSimulacion(null);

    try {
      const response = await fetch('/api/turnos/diagnostico/simular-no-respuesta/', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ turno_id: resultadoOptimizacion.proceso_2.turno_candidato_id }),
      });

      const data = await response.json();

      if (response.ok) {
        setResultadoSimulacion(data);
      } else {
        setErrorSimulacion(data.error || 'Error al simular no respuesta');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorSimulacion('Error de conexión con el servidor');
    } finally {
      setLoadingSimulacion(false);
    }
  };

  const handleFidelizacion = async () => {
    setLoadingFidelizacion(true);
    setErrorFidelizacion('');
    setResultadoFidelizacion(null);

    try {
      const body: any = {
        // En diagnóstico siempre enviamos los emails reales
        enviar_emails: true,
      };

      if (diasInactividad) {
        body.dias_inactividad = parseInt(diasInactividad);
      }

      const response = await fetch('/api/turnos/diagnostico/fidelizacion-clientes/', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setResultadoFidelizacion(data);
      } else {
        setErrorFidelizacion(data.error || 'Error al ejecutar fidelización');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorFidelizacion('Error de conexión con el servidor');
    } finally {
      setLoadingFidelizacion(false);
    }
  };

  const getResultadoIcon = (resultado: string) => {
    switch (resultado) {
      case 'exitoso':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'no_aplica':
        return <Info className="h-5 w-5 text-blue-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Herramientas de Diagnóstico</h1>
        <p className="text-muted-foreground">
          Ejecuta manualmente los procesos automáticos para testing y diagnóstico
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
          Estas herramientas son solo para testing y diagnóstico. Los cambios que realices aquí son reales
          y afectarán la base de datos (cancelaciones, créditos, emails enviados).
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OPTIMIZACIÓN DE AGENDA */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proceso 2: Optimización de Agenda</CardTitle>
              <CardDescription>
                Simula la cancelación de un turno y el proceso de rellenar el hueco
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="turno_id">ID del Turno a Cancelar</Label>
                <Input
                  id="turno_id"
                  type="number"
                  placeholder="Ej: 123"
                  value={turnoId}
                  onChange={(e) => setTurnoId(e.target.value)}
                  disabled={loadingOptimizacion}
                />
                <p className="text-sm text-muted-foreground">
                  Este turno será cancelado y se intentará rellenar el hueco con otro cliente
                </p>
              </div>

              <Button
                onClick={handleOptimizacion}
                disabled={loadingOptimizacion || !turnoId}
                className="w-full"
              >
                {loadingOptimizacion ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Gatillar Optimización de Agenda
                  </>
                )}
              </Button>

              {/* Botón de Simular No Respuesta - Solo aparece después de ejecutar optimización */}
              {resultadoOptimizacion?.proceso_2?.status === 'propuesta_enviada' && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Info className="h-4 w-4" />
                    <span>
                      Oferta enviada a {resultadoOptimizacion.proceso_2.cliente_contactado}. Puedes simular
                      que no responde para pasar al siguiente candidato.
                    </span>
                  </div>
                  <Button
                    onClick={handleSimularNoRespuesta}
                    disabled={loadingSimulacion}
                    variant="outline"
                    className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                  >
                    {loadingSimulacion ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Simulando...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Simular No Respuesta (Skip 15 min)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Simulación */}
          {errorSimulacion && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error en Simulación</AlertTitle>
              <AlertDescription>{errorSimulacion}</AlertDescription>
            </Alert>
          )}

          {/* Resultados Simulación */}
          {resultadoSimulacion && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-700">Simulación de No Respuesta</CardTitle>
                <CardDescription>
                  Oferta expirada y proceso automático ejecutado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logs de Simulación */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Logs de Ejecución</h3>
                  {resultadoSimulacion.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-orange-50">
                      {getResultadoIcon(log.resultado)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          Paso {log.paso}: {log.accion}
                        </p>
                        <p className="text-sm text-muted-foreground">{log.detalle}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Siguiente Candidato */}
                {resultadoSimulacion.siguiente_candidato ? (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-700">Siguiente candidato contactado</AlertTitle>
                    <AlertDescription className="text-green-600">
                      <div className="space-y-1 mt-2">
                        <p>
                          <strong>Cliente:</strong> {resultadoSimulacion.siguiente_candidato.cliente}
                        </p>
                        <p>
                          <strong>Turno ID:</strong> {resultadoSimulacion.siguiente_candidato.turno_id}
                        </p>
                        <p className="text-xs mt-2 italic">
                          ✉️ Email automático enviado con oferta de reagendamiento
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Sin más candidatos</AlertTitle>
                    <AlertDescription>
                      No hay más clientes en la fila para ofrecerles este turno
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resultados Optimización */}
          {errorOptimizacion && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorOptimizacion}</AlertDescription>
            </Alert>
          )}

          {resultadoOptimizacion && (
            <Card>
              <CardHeader>
                <CardTitle>Resultados - Turno #{resultadoOptimizacion.turno_id}</CardTitle>
                <CardDescription>
                  {resultadoOptimizacion.turno_info.servicio} - {resultadoOptimizacion.turno_info.cliente}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logs */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Logs de Ejecución</h3>
                  {resultadoOptimizacion.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                      {getResultadoIcon(log.resultado)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          Paso {log.paso}: {log.accion}
                        </p>
                        <p className="text-sm text-muted-foreground">{log.detalle}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Crédito aplicado:</span>
                    <span className="font-medium">
                      {resultadoOptimizacion.credito_aplicado ? 'Sí' : 'No'}
                    </span>
                  </div>
                  {resultadoOptimizacion.credito_aplicado && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monto acreditado:</span>
                      <span className="font-medium">${resultadoOptimizacion.monto_credito}</span>
                    </div>
                  )}
                  {resultadoOptimizacion.proceso_2 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Estado Proceso 2:</span>
                      <span className="font-medium">
                        {resultadoOptimizacion.proceso_2.status === 'propuesta_enviada'
                          ? `Propuesta enviada a ${resultadoOptimizacion.proceso_2.cliente_contactado}`
                          : resultadoOptimizacion.proceso_2.motivo}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* FIDELIZACIÓN DE CLIENTES */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proceso 1: Fidelización de Clientes</CardTitle>
              <CardDescription>
                Identifica clientes inactivos y envía ofertas de regreso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dias_inactividad">Días de Inactividad (opcional)</Label>
                <Input
                  id="dias_inactividad"
                  type="number"
                  placeholder="Ej: 60"
                  value={diasInactividad}
                  onChange={(e) => setDiasInactividad(e.target.value)}
                  disabled={loadingFidelizacion}
                />
                <p className="text-sm text-muted-foreground">
                  Deja vacío para usar la lógica automática (servicio → global)
                </p>
              </div>

              <Button
                onClick={handleFidelizacion}
                disabled={loadingFidelizacion}
                className="w-full"
              >
                {loadingFidelizacion ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Gatillar Fidelización de Clientes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Resultados Fidelización */}
          {errorFidelizacion && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorFidelizacion}</AlertDescription>
            </Alert>
          )}

          {resultadoFidelizacion && (
            <Card>
              <CardHeader>
                <CardTitle>Resultados de Fidelización</CardTitle>
                <CardDescription>{resultadoFidelizacion.mensaje}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumen */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">
                      {resultadoFidelizacion.resumen.total_candidatos}
                    </p>
                    <p className="text-sm text-blue-600">Candidatos identificados</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-2xl font-bold text-green-700">
                      {resultadoFidelizacion.resumen.emails_enviados}
                    </p>
                    <p className="text-sm text-green-600">Emails enviados</p>
                  </div>
                </div>

                {resultadoFidelizacion.resumen.emails_fallidos > 0 && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Algunos emails fallaron</AlertTitle>
                    <AlertDescription>
                      Hubo {resultadoFidelizacion.resumen.emails_fallidos} errores al enviar emails.
                      Revisa el detalle por cliente y los logs del servidor para más información.
                    </AlertDescription>
                  </Alert>
                )}

                {resultadoFidelizacion.resumen.emails_simulados > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Clientes sin email enviado</AlertTitle>
                    <AlertDescription>
                      Hay {resultadoFidelizacion.resumen.emails_simulados} candidatos en los que no se envió email
                      (por falta de datos o condiciones). Revisa el motivo en cada tarjeta.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Lista de Candidatos */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Clientes Candidatos</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {resultadoFidelizacion.resultados.map((cliente, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{cliente.nombre}</p>
                            <p className="text-sm text-muted-foreground">{cliente.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {cliente.dias_sin_turno} días sin turno (umbral: {cliente.umbral_usado} días)
                            </p>
                            {typeof cliente.saldo_billetera === 'number' && (
                              <p className="text-xs text-purple-700">
                                {cliente.saldo_billetera > 0
                                  ? `${cliente.nombre.split(' ')[0]} tiene crédito en su billetera ($${cliente.saldo_billetera.toFixed(2)}). No recibirá descuento por fidelización.`
                                  : `${cliente.nombre.split(' ')[0]} no tiene crédito en su billetera. Aplicará el descuento de fidelización.`}
                              </p>
                            )}
                            {cliente.servicio_propuesto && (
                              <p className="text-xs text-blue-600">
                                {cliente.servicio_propuesto.nombre} - $
                                {cliente.servicio_propuesto.precio_con_descuento.toFixed(2)} (desc.)
                              </p>
                            )}
                            {cliente.email_status === 'simulado' && (
                              <p className="text-xs text-muted-foreground mt-1">
                                No se envió email a este cliente
                                {cliente.email_error ? `: ${cliente.email_error}` : ''}.
                              </p>
                            )}
                            {cliente.email_status === 'error' && (
                              <p className="text-xs text-red-600 mt-1">
                                Error al enviar email
                                {cliente.email_error ? `: ${cliente.email_error}` : ''}.
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {cliente.email_status === 'exitoso' && (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            )}
                            {cliente.email_status === 'simulado' && (
                              <Info className="h-5 w-5 text-blue-600" />
                            )}
                            {cliente.email_status === 'error' && (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
