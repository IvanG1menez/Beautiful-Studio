"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  AlertCircle,
  Building2,
  Calendar as CalendarIcon,
  Check,
  Download,
  Loader2,
  Printer,
  Scissors,
  User,
} from "lucide-react";
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
  empresa?: {
    nombre_empresa?: string;
    nombre_comercial?: string;
    razon_social?: string;
    cuit?: string;
    fecha_fundacion?: string | null;
  };
  turno: {
    id: number;
    servicio_nombre: string;
    profesional_nombre: string;
    cliente_nombre: string;
    cliente_email?: string;
    fecha_hora: string | null;
    precio_final: string;
    senia_pagada?: string;
    duracion_minutos?: number | null;
  };
  pago?: {
    monto?: string;
    moneda?: string;
    payment_id?: string;
    estado?: string;
    creado_en?: string;
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
  const comprobanteRef = useRef<HTMLDivElement | null>(null);

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

  const formatearMoneda = (valor?: string) => {
    const numero = Number(valor ?? "0");
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(Number.isNaN(numero) ? 0 : numero);
  };

  const handleImprimirComprobante = () => {
    window.print();
  };

  const handleDescargarPDF = async () => {
    if (!comprobante?.turno) return;

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      const turno = comprobante.turno;
      const empresa = comprobante.empresa;
      const pago = comprobante.pago;
      const fechaTurno = turno.fecha_hora ? new Date(turno.fecha_hora) : null;
      const fechaPago = pago?.creado_en ? new Date(pago.creado_en) : null;

      let y = 56;
      doc.setFillColor(107, 70, 193);
      doc.rect(40, 32, 515, 64, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Comprobante de pago", 56, y);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(empresa?.nombre_comercial || empresa?.nombre_empresa || "Beautiful Studio", 56, y + 20);

      doc.setTextColor(33, 33, 33);
      y = 132;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Datos del turno", 40, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.text(`Nro. de turno: #${turno.id}`, 40, y);
      y += 18;
      doc.text(`Servicio: ${turno.servicio_nombre}`, 40, y);
      y += 18;
      doc.text(`Profesional: ${turno.profesional_nombre}`, 40, y);
      y += 18;
      doc.text(`Cliente: ${turno.cliente_nombre}`, 40, y);
      y += 18;
      if (turno.cliente_email) {
        doc.text(`Email: ${turno.cliente_email}`, 40, y);
        y += 18;
      }
      if (fechaTurno) {
        doc.text(`Fecha y hora: ${fechaTurno.toLocaleString("es-AR")}`, 40, y);
        y += 18;
      }

      y += 8;
      doc.setFont("helvetica", "bold");
      doc.text("Datos del pago", 40, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.text(`Monto pagado: ${formatearMoneda(pago?.monto || turno.precio_final)}`, 40, y);
      y += 18;
      doc.text(`Estado: ${pago?.estado || "approved"}`, 40, y);
      y += 18;
      doc.text(`Referencia: ${pago?.payment_id || "N/D"}`, 40, y);
      y += 18;
      if (fechaPago) {
        doc.text(`Fecha de pago: ${fechaPago.toLocaleString("es-AR")}`, 40, y);
        y += 18;
      }

      y += 8;
      doc.setDrawColor(224, 224, 224);
      doc.line(40, y, 555, y);
      y += 20;
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text("Comprobante emitido digitalmente por Beautiful Studio.", 40, y);

      doc.save(`comprobante-turno-${turno.id}.pdf`);
    } catch (e) {
      console.error("Error al generar PDF:", e);
      setError("No se pudo generar el PDF del comprobante.");
    }
  };

  if (loading && !servicio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-purple-50 to-pink-50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (success) {
    const turno = comprobante?.turno;
    const fechaTurno = turno?.fecha_hora
      ? new Date(turno.fecha_hora)
      : null;
    const fechaPago = comprobante?.pago?.creado_en
      ? new Date(comprobante.pago.creado_en)
      : null;

    return (
      <div className="min-h-screen bg-linear-to-br from-violet-50 via-fuchsia-50 to-rose-50 p-4 sm:p-8">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="no-print rounded-2xl border border-violet-200 bg-white/80 p-4 text-center shadow-sm backdrop-blur">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Pago confirmado y turno reservado</h2>
            <p className="mt-1 text-sm text-gray-600">
              Ya tenés tu comprobante listo. Podés imprimirlo o descargarlo en PDF.
            </p>
          </div>

          <Card id="comprobante-print" ref={comprobanteRef} className="overflow-hidden border-violet-200 shadow-lg">
            <div className="bg-linear-to-r from-violet-700 to-fuchsia-600 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-violet-100">Comprobante</p>
                  <h3 className="text-xl font-semibold">Detalle de pago y reserva</h3>
                </div>
                <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                  Turno #{turno?.id ?? "-"}
                </div>
              </div>
            </div>

            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-violet-700">
                    <Building2 className="h-4 w-4" />
                    <p className="text-sm font-semibold">Datos del negocio</p>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">
                      {comprobante?.empresa?.nombre_comercial || comprobante?.empresa?.nombre_empresa || "Beautiful Studio"}
                    </p>
                    {comprobante?.empresa?.razon_social && <p>Razón social: {comprobante.empresa.razon_social}</p>}
                    {comprobante?.empresa?.cuit && <p>CUIT: {comprobante.empresa.cuit}</p>}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-violet-700">
                    <User className="h-4 w-4" />
                    <p className="text-sm font-semibold">Cliente</p>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">{turno?.cliente_nombre || "-"}</p>
                    {turno?.cliente_email && <p>{turno.cliente_email}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <p className="mb-3 text-sm font-semibold text-violet-900">Resumen del turno</p>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <p>
                    <span className="font-medium text-gray-900">Servicio:</span> {turno?.servicio_nombre || "-"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Profesional:</span> {turno?.profesional_nombre || "-"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Fecha:</span>{" "}
                    {fechaTurno
                      ? fechaTurno.toLocaleString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      : "A confirmar"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Duración:</span>{" "}
                    {turno?.duracion_minutos ? `${turno.duracion_minutos} min` : "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-900">Pago</p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {comprobante?.pago?.estado || "approved"}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-emerald-900">
                  <p>
                    <span className="font-medium">Monto:</span>{" "}
                    {formatearMoneda(comprobante?.pago?.monto || turno?.precio_final || "0")}
                  </p>
                  <p>
                    <span className="font-medium">Referencia:</span> {comprobante?.pago?.payment_id || "N/D"}
                  </p>
                  <p>
                    <span className="font-medium">Fecha de pago:</span>{" "}
                    {fechaPago ? fechaPago.toLocaleString("es-AR") : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="no-print flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={handleImprimirComprobante}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button onClick={handleDescargarPDF} className="bg-violet-600 hover:bg-violet-700">
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
            <Button variant="secondary" onClick={handleVolver}>
              Ver mis turnos
            </Button>
          </div>
        </div>

        <style jsx global>{`
          @media print {
            body {
              background: #ffffff !important;
            }

            .no-print {
              display: none !important;
            }

            #comprobante-print {
              box-shadow: none !important;
              border: 1px solid #d4d4d4 !important;
              margin: 0 auto;
              max-width: 100% !important;
            }
          }
        `}</style>
      </div>
    );
  }

  if (isWaitingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-purple-50 to-pink-50 p-4">
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
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-purple-50 to-pink-50 p-4">
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
