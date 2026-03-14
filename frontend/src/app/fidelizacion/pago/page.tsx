"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthHeaders } from "@/lib/auth-headers";
import { AlertCircle, Calendar as CalendarIcon, Check, Loader2, Scissors, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  precio: string;
  descuento_fidelizacion_pct?: string;
  descuento_fidelizacion_monto?: string;
  porcentaje_sena: string;
}

interface Empleado {
  id: number;
  first_name: string;
  last_name: string;
}

interface ComprobanteTurno {
  turno: {
    id: number;
    servicio_nombre: string;
    profesional_nombre: string;
    cliente_nombre: string;
    fecha_hora: string | null;
    precio_final: string;
  };
}

const API_BASE_URL = "/api";

export default function PagoFidelizacionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const servicioId = searchParams.get("servicio");
  const empleadoId = searchParams.get("empleado");
  const fecha = searchParams.get("fecha");
  const hora = searchParams.get("hora");

  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [isWaitingPayment, setIsWaitingPayment] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string>("");
  const [turnoId, setTurnoId] = useState<number | null>(null);
  const [comprobante, setComprobante] = useState<ComprobanteTurno | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mpWindowRef = useRef<Window | null>(null);
  const mpTabCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mpTabClosed, setMpTabClosed] = useState(false);
  const [success, setSuccess] = useState(false);

  // Cargar datos de servicio y profesional
  useEffect(() => {
    const loadData = async () => {
      if (!servicioId || !empleadoId) {
        setError("Faltan datos del servicio o profesional en el enlace.");
        setLoading(false);
        return;
      }

      try {
        const headers = getAuthHeaders();

        // Cargar servicio normalmente
        const servRes = await fetch(`${API_BASE_URL}/servicios/${servicioId}/`, {
          headers,
        });
        if (servRes.ok) {
          const servData = await servRes.json();
          setServicio(servData);
        } else {
          setError("No se pudo cargar el servicio.");
        }

        // Para el profesional, los clientes NO tienen permiso para acceder
        // al detalle /empleados/{id}/ (solo propietario/admin). En su lugar
        // usamos el listado filtrado y buscamos el profesional por ID.
        const empListRes = await fetch(
          `${API_BASE_URL}/empleados/?servicio=${servicioId}&disponible=true&page_size=100`,
          { headers },
        );

        if (empListRes.ok) {
          const data = await empListRes.json();
          const lista = Array.isArray(data.results) ? data.results : data;
          const idBuscado = Number(empleadoId);
          const encontrado = lista.find((e: any) => e.id === idBuscado);
          if (encontrado) {
            setEmpleado({
              id: encontrado.id,
              first_name: encontrado.first_name,
              last_name: encontrado.last_name,
            });
          }
          // Si no se encuentra, no mostramos error: dejamos "Profesional sugerido".
        } else {
          // No romper el flujo si falla la carga del profesional
          console.warn("No se pudo cargar el listado de profesionales para fidelización.");
        }
      } catch (e) {
        console.error("Error cargando datos de fidelización:", e);
        setError("No se pudieron cargar los datos. Intentá nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [servicioId, empleadoId]);

  // Polling de pago aprobado
  useEffect(() => {
    if (isWaitingPayment && preferenceId) {
      if (pollingIntervalRef.current !== null) return;

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/mercadopago/verificar-pago/${preferenceId}/`,
            { headers: getAuthHeaders() },
          );
          if (res.ok) {
            const payload = await res.json();
            if (payload.status === "approved") {
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              setIsWaitingPayment(false);
              if (payload.turno_id) {
                setTurnoId(payload.turno_id);
              }
              setSuccess(true);
            }
          }
        } catch {
          // Ignorar errores de red durante el polling
        }
      }, 3000);
    }

    if (!isWaitingPayment && pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!isWaitingPayment && mpTabCheckRef.current !== null) {
      clearInterval(mpTabCheckRef.current);
      mpTabCheckRef.current = null;
    }

    return () => {
      if (pollingIntervalRef.current !== null) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (mpTabCheckRef.current !== null) {
        clearInterval(mpTabCheckRef.current);
        mpTabCheckRef.current = null;
      }
    };
  }, [isWaitingPayment, preferenceId]);

  // Cargar detalles del turno/pago una vez que tenemos el turno creado
  useEffect(() => {
    const loadComprobante = async () => {
      if (!success || !turnoId) return;

      try {
        const res = await fetch(`${API_BASE_URL}/mercadopago/comprobante/${turnoId}/`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setComprobante(data);
        }
      } catch (e) {
        console.error("Error cargando comprobante de pago:", e);
      }
    };

    loadComprobante();
  }, [success, turnoId]);

  const calcularPrecioConDescuento = () => {
    if (!servicio) return 0;
    let precio = parseFloat(servicio.precio || "0") || 0;
    const monto = parseFloat(servicio.descuento_fidelizacion_monto || "0") || 0;
    const pct = parseFloat(servicio.descuento_fidelizacion_pct || "0") || 0;

    if (monto > 0) {
      return Math.max(0, precio - monto);
    }
    if (pct > 0) {
      return precio * (1 - pct / 100);
    }
    return precio;
  };

  const handlePagar = async () => {
    if (!servicio || !empleado || !fecha || !hora) {
      setError("Faltan datos para iniciar el pago.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const fechaHora = `${fecha}T${hora}:00`;

      const response = await fetch(`${API_BASE_URL}/mercadopago/preferencia-sin-turno/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          servicio_id: servicio.id,
          empleado_id: empleado.id,
          fecha_hora: fechaHora,
          notas_cliente: "",
          usar_sena: true,
          creditos_a_aplicar: 0,
          aplicar_descuento_fidelizacion: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Error creando preferencia MP fidelización:", text);
        setError("No se pudo iniciar el pago. Intentá nuevamente.");
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (result.status === "free") {
        if (result.turno_id) {
          setTurnoId(result.turno_id);
        }
        setSuccess(true);
        setLoading(false);
        return;
      }

      const mpWin = window.open(result.init_point, "_blank");
      mpWindowRef.current = mpWin;
      setPreferenceId(result.preference_id);
      setIsWaitingPayment(true);
      setMpTabClosed(false);

      if (mpWin) {
        mpTabCheckRef.current = setInterval(() => {
          if (mpWin.closed) {
            clearInterval(mpTabCheckRef.current!);
            mpTabCheckRef.current = null;
            mpWindowRef.current = null;
            if (pollingIntervalRef.current !== null) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setMpTabClosed(true);
            setIsWaitingPayment(false);
          }
        }, 1000);
      }
    } catch (e: any) {
      console.error("Error iniciando pago fidelización:", e);
      setError(e?.message || "Error al iniciar el pago. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    router.push("/dashboard/cliente/turnos");
  };

  const handleCancelarPago = () => {
    if (mpWindowRef.current && !mpWindowRef.current.closed) {
      mpWindowRef.current.close();
    }
    mpWindowRef.current = null;
    if (mpTabCheckRef.current !== null) {
      clearInterval(mpTabCheckRef.current);
      mpTabCheckRef.current = null;
    }
    if (pollingIntervalRef.current !== null) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsWaitingPayment(false);
    setPreferenceId("");
  };

  if (loading && !servicio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (success) {
    const turno = comprobante?.turno;
    const fechaTurno = turno?.fecha_hora
      ? new Date(turno.fecha_hora)
      : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Listo! Tu turno quedó reservado</h2>
            <p className="text-gray-600 mb-4">
              El pago se registró correctamente. Vas a recibir la confirmación del salón.
            </p>

            {turno && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 text-left text-sm">
                <p className="font-semibold text-purple-900 mb-2">Detalles de tu turno</p>
                <div className="space-y-1 text-purple-900">
                  <p>
                    <span className="font-medium">Servicio:</span> {turno.servicio_nombre}
                  </p>
                  <p>
                    <span className="font-medium">Profesional:</span> {turno.profesional_nombre}
                  </p>
                  {fechaTurno && (
                    <p>
                      <span className="font-medium">Fecha y hora:</span> {fechaTurno.toLocaleString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Monto pagado:</span> ${turno.precio_final}
                  </p>
                </div>
              </div>
            )}

            <Button onClick={handleVolver}>Ver mis turnos</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isWaitingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center gap-4">
            {mpTabClosed ? (
              <>
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold">Cerraste la ventana de pago</h2>
                <p className="text-gray-600 text-sm mb-2">
                  El pago no fue completado. Podés intentar nuevamente si querés reservar el turno.
                </p>
                <Button variant="outline" onClick={handleCancelarPago}>
                  Volver
                </Button>
              </>
            ) : (
              <>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-100 border-t-purple-500 animate-spin" />
                </div>
                <h2 className="text-xl font-bold">Esperando confirmación de pago...</h2>
                <p className="text-gray-600 text-sm">
                  Completá el pago en la pestaña de Mercado Pago. Esta pantalla se actualizará automáticamente.
                </p>
                <Button variant="ghost" size="sm" onClick={handleCancelarPago}>
                  Cancelar y volver
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const precioOriginal = servicio ? parseFloat(servicio.precio || "0") || 0 : 0;
  const precioConDescuento = calcularPrecioConDescuento();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Confirmá tu turno con descuento</CardTitle>
          <CardDescription>
            Revisá los datos y avanzá al pago promocional de fidelización.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3 bg-white/70 rounded-lg px-4 py-3">
            <Scissors className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Servicio</p>
              <p className="font-medium text-gray-800">{servicio?.nombre}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/70 rounded-lg px-4 py-3">
            <User className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Profesional</p>
              <p className="font-medium text-gray-800">
                {empleado ? `${empleado.first_name} ${empleado.last_name}` : "Profesional sugerido"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/70 rounded-lg px-4 py-3">
            <CalendarIcon className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Fecha y hora</p>
              <p className="font-medium text-gray-800">
                {fecha && hora ? `${fecha} · ${hora} hs` : "A coordinar"}
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-900">
            <p className="font-medium mb-1">Precio promocional por fidelización</p>
            {precioConDescuento < precioOriginal ? (
              <p>
                Precio original: <span className="line-through">${precioOriginal.toFixed(2)}</span>{" "}
                · Ahora pagás: <strong>${precioConDescuento.toFixed(2)}</strong>
              </p>
            ) : (
              <p>
                No hay descuento específico configurado para este servicio. Se aplicará, si corresponde,
                el beneficio global de fidelización al momento de cobrar.
              </p>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="outline" onClick={handleVolver} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handlePagar} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando pago...
                </>
              ) : (
                "Confirmar y pagar"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
