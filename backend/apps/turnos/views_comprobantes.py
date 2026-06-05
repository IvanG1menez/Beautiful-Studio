from decimal import Decimal
from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.models import ConfiguracionGlobal
from apps.turnos.models import MovimientoPagoTurno, Turno
from apps.turnos.serializers import calcular_monto_pendiente_turno


def _puede_ver_turno(user, turno: Turno) -> bool:
    if user.is_staff or getattr(user, "role", None) in {"propietario", "superusuario"}:
        return True
    if getattr(user, "role", None) == "profesional":
        return hasattr(user, "profesional_profile") and turno.empleado_id == user.profesional_profile.id
    if getattr(user, "role", None) == "cliente":
        return hasattr(user, "cliente_profile") and turno.cliente_id == user.cliente_profile.id
    return False


def _moneda(valor) -> str:
    return str(Decimal(str(valor or "0")).quantize(Decimal("0.01")))


def _empresa_data():
    config = ConfiguracionGlobal.get_config()
    return {
        "nombre_empresa": config.nombre_empresa or "Beautiful Studio",
        "nombre_comercial": config.nombre_comercial or config.nombre_empresa or "Beautiful Studio",
        "razon_social": config.razon_social or "",
        "cuit": config.cuit or "",
        "telefono": getattr(config, "telefono", "") or "",
        "email": getattr(config, "email", "") or "",
        "direccion": getattr(config, "direccion", "") or "",
    }


def _turno_data(turno: Turno) -> dict:
    cliente_user = getattr(turno.cliente, "user", None)
    return {
        "id": turno.id,
        "cliente_nombre": getattr(turno.cliente, "nombre_completo", ""),
        "cliente_email": getattr(cliente_user, "email", ""),
        "cliente_dni": getattr(cliente_user, "dni", "") or getattr(turno, "walkin_dni", "") or "",
        "profesional_nombre": getattr(turno.empleado, "nombre_completo", ""),
        "servicio_nombre": getattr(turno.servicio, "nombre", ""),
        "categoria_nombre": getattr(getattr(turno.servicio, "categoria", None), "nombre", ""),
        "fecha_hora": turno.fecha_hora.isoformat() if turno.fecha_hora else None,
        "fecha_hora_fin": turno.fecha_hora_fin.isoformat() if turno.fecha_hora_fin else None,
        "fecha_hora_completado": turno.fecha_hora_completado.isoformat() if turno.fecha_hora_completado else None,
        "duracion_minutos": getattr(turno.servicio, "duracion_minutos", None),
        "estado": turno.estado,
        "estado_display": turno.get_estado_display(),
        "precio_final": _moneda(turno.precio_final or getattr(turno.servicio, "precio", 0)),
        "senia_pagada": _moneda(turno.senia_pagada),
        "monto_pendiente": _moneda(calcular_monto_pendiente_turno(turno)),
    }


def _movimientos_data(turno: Turno) -> list[dict]:
    movimientos = list(
        turno.movimientos_pago.filter(estado="aprobado").select_related("registrado_por")
    )
    if not movimientos:
        movimientos = []
        for pago in turno.pagos_mercadopago.filter(estado="approved"):
            movimientos.append(
                MovimientoPagoTurno(
                    turno=turno,
                    cliente=turno.cliente,
                    monto=pago.monto,
                    metodo="mercadopago",
                    tipo="senia" if turno.resolver_tipo_pago() == "SENIA" else "pago_completo",
                    estado="aprobado",
                    referencia=pago.payment_id or pago.preference_id or "",
                    descripcion=pago.descripcion,
                    origen="mercadopago_historico",
                    creado_en=pago.creado_en,
                )
            )
        if not movimientos and Decimal(str(turno.senia_pagada or 0)) > Decimal("0.00"):
            movimientos.append(
                MovimientoPagoTurno(
                    turno=turno,
                    cliente=turno.cliente,
                    monto=turno.senia_pagada,
                    metodo=turno.metodo_pago or "manual",
                    tipo="senia" if turno.resolver_tipo_pago() == "SENIA" else "pago_completo",
                    estado="aprobado",
                    referencia="historico",
                    descripcion="Pago historico registrado en el turno",
                    origen="turno_historico",
                    creado_en=turno.fecha_pago_registrado or turno.updated_at,
                )
            )

    return [
        {
            "id": mov.id,
            "monto": _moneda(mov.monto),
            "metodo": mov.metodo,
            "metodo_display": mov.get_metodo_display() if mov.pk else dict(MovimientoPagoTurno.METODO_CHOICES).get(mov.metodo, mov.metodo),
            "tipo": mov.tipo,
            "tipo_display": mov.get_tipo_display() if mov.pk else dict(MovimientoPagoTurno.TIPO_CHOICES).get(mov.tipo, mov.tipo),
            "estado": mov.estado,
            "referencia": mov.referencia,
            "descripcion": mov.descripcion,
            "origen": mov.origen,
            "creado_en": mov.creado_en.isoformat() if mov.creado_en else None,
        }
        for mov in movimientos
    ]


def _comprobante_data(turno: Turno, tipo: str) -> dict:
    movimientos = _movimientos_data(turno)
    total_abonado = sum(Decimal(mov["monto"]) for mov in movimientos)
    total_turno = Decimal(_turno_data(turno)["precio_final"])
    saldo = max(Decimal("0.00"), total_turno - total_abonado)
    emitido_en = timezone.now()
    turno_info = _turno_data(turno)
    ultimo_movimiento = movimientos[-1] if movimientos else None

    if tipo == "pago":
        titulo = "Comprobante de pago"
        estado_comprobante = "PAGO REGISTRADO"
        subtitulo = "Constancia de cobro aplicado al turno"
        fecha_principal = (ultimo_movimiento or {}).get("creado_en") or emitido_en.isoformat()
        fecha_principal_label = "Fecha de pago"
        monto_principal = _moneda((ultimo_movimiento or {}).get("monto") or total_abonado)
        secciones = {
            "principal": "Informacion del pago",
            "secundaria": "Turno asociado",
            "movimientos": "Detalle de pagos registrados",
        }
        mensaje = "Este comprobante acredita los pagos registrados para la reserva del turno."
    else:
        titulo = "Comprobante de turno finalizado"
        estado_comprobante = "SERVICIO FINALIZADO"
        subtitulo = "Constancia de prestacion del servicio"
        fecha_principal = turno_info["fecha_hora_completado"] or emitido_en.isoformat()
        fecha_principal_label = "Fecha de finalizacion"
        monto_principal = _moneda(total_turno)
        secciones = {
            "principal": "Informacion de finalizacion",
            "secundaria": "Servicio realizado",
            "movimientos": "Pagos aplicados al cierre",
        }
        mensaje = "Este comprobante acredita que el turno fue realizado y finalizado en el sistema."

    return {
        "tipo": tipo,
        "numero": f"TUR-{turno.id:08d}-{tipo.upper()[:3]}",
        "emitido_en": emitido_en.isoformat(),
        "titulo": titulo,
        "estado_comprobante": estado_comprobante,
        "subtitulo": subtitulo,
        "fecha_principal": fecha_principal,
        "fecha_principal_label": fecha_principal_label,
        "monto_principal": monto_principal,
        "secciones": secciones,
        "mensaje": mensaje,
        "empresa": _empresa_data(),
        "turno": turno_info,
        "pago_principal": ultimo_movimiento,
        "movimientos": movimientos,
        "resumen": {
            "subtotal": _moneda(total_turno),
            "monto_abonado": _moneda(total_abonado),
            "saldo_pendiente": _moneda(saldo),
        },
        "leyenda": "Comprobante electronico sin valor fiscal. No valido como factura ante AFIP.",
    }


def _get_turno_o_error(request, turno_id: int):
    try:
        turno = Turno.objects.select_related(
            "cliente__user",
            "empleado__user",
            "servicio__categoria",
        ).get(pk=turno_id)
    except Turno.DoesNotExist:
        return None, Response({"detail": "Turno no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if not _puede_ver_turno(request.user, turno):
        return None, Response({"detail": "No tiene permisos para ver este comprobante."}, status=status.HTTP_403_FORBIDDEN)
    return turno, None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def comprobante_pago_turno(request, turno_id: int):
    turno, error = _get_turno_o_error(request, turno_id)
    if error:
        return error

    if not turno.movimientos_pago.filter(estado="aprobado").exists() and not turno.pagos_mercadopago.filter(estado="approved").exists() and Decimal(str(turno.senia_pagada or 0)) <= Decimal("0.00"):
        return Response({"detail": "Este turno no tiene pagos registrados."}, status=status.HTTP_404_NOT_FOUND)

    return Response(_comprobante_data(turno, "pago"))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def comprobante_final_turno(request, turno_id: int):
    turno, error = _get_turno_o_error(request, turno_id)
    if error:
        return error

    if turno.estado != "completado":
        return Response({"detail": "El turno todavia no fue finalizado."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(_comprobante_data(turno, "final"))


def _draw_line(pdf, y):
    pdf.line(40, y, 555, y)


def _comprobante_pago_pdf_response(data: dict):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 70
    turno = data["turno"]
    pago = data.get("pago_principal") or {}

    pdf.setFont("Helvetica-Bold", 28)
    pdf.setFillColorRGB(0.0, 0.12, 0.70)
    pdf.drawString(58, y, "Beautiful Pay")
    pdf.setFillColorRGB(0, 0, 0)
    y -= 72

    pdf.setFont("Helvetica-Bold", 25)
    pdf.drawString(58, y, "Comprobante de pago")
    y -= 40
    pdf.setLineWidth(1)
    pdf.setStrokeColorRGB(0.75, 0.75, 0.75)
    pdf.line(58, y, 535, y)
    y -= 38

    pdf.setFont("Helvetica", 18)
    fecha = data.get("fecha_principal") or data.get("emitido_en") or ""
    pdf.drawString(58, y, fecha[:19].replace("T", " "))
    y -= 34
    pdf.line(58, y, 535, y)
    y -= 40

    pdf.setFont("Helvetica", 18)
    pdf.setFillColorRGB(0.45, 0.45, 0.45)
    pdf.drawString(58, y, "Total")
    pdf.setFillColorRGB(0, 0, 0)
    y -= 38
    pdf.setFont("Helvetica-Bold", 36)
    pdf.drawString(58, y, f"${data.get('monto_principal') or pago.get('monto') or '0.00'}")
    y -= 50

    pdf.setFont("Helvetica", 16)
    pdf.setFillColorRGB(0.45, 0.45, 0.45)
    pdf.drawString(58, y, "Servicio:")
    pdf.setFillColorRGB(0, 0, 0)
    pdf.drawString(145, y, turno.get("servicio_nombre") or "-")
    y -= 32

    pdf.setFillColorRGB(0.45, 0.45, 0.45)
    pdf.drawString(58, y, "Profesional:")
    pdf.setFillColorRGB(0, 0, 0)
    pdf.drawString(165, y, turno.get("profesional_nombre") or "-")
    y -= 32

    pdf.setFillColorRGB(0.45, 0.45, 0.45)
    pdf.drawString(58, y, "Tipo de pago:")
    pdf.setFillColorRGB(0, 0, 0)
    pdf.drawString(178, y, pago.get("tipo_display") or "-")
    y -= 32

    if pago.get("referencia"):
        pdf.setFont("Helvetica", 10)
        pdf.setFillColorRGB(0.45, 0.45, 0.45)
        pdf.drawString(58, y, f"Operacion: {pago['referencia']}")
        y -= 20

    pdf.setFont("Helvetica-Oblique", 9)
    pdf.drawString(58, 70, data["leyenda"])
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="comprobante_pago_turno_{turno["id"]}.pdf"'
    return response


def _comprobante_final_pdf_response(data: dict):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 70
    turno = data["turno"]
    resumen = data["resumen"]

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(58, y, "Comprobante de turno finalizado")
    y -= 28
    pdf.setFillColorRGB(0.22, 0.0, 0.42)
    pdf.roundRect(58, y - 88, 420, 88, 8, fill=True, stroke=False)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(78, y - 20, "SERVICIO FINALIZADO")
    pdf.setFont("Helvetica", 8)
    pdf.drawString(78, y - 38, "Constancia de prestacion del servicio")
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(78, y - 63, f"${resumen['subtotal']}")
    pdf.setFont("Helvetica", 8)
    pdf.drawString(78, y - 78, f"Comprobante N {data['numero']}")
    pdf.setFillColorRGB(0, 0, 0)
    y -= 112

    pdf.setFont("Helvetica", 8)
    pdf.drawString(58, y, data["empresa"].get("nombre_comercial") or data["empresa"].get("nombre_empresa") or "Beautiful Studio")
    y -= 12
    if data["empresa"].get("razon_social"):
        pdf.drawString(58, y, f"Razon social: {data['empresa']['razon_social']}")
        y -= 12
    _draw_line(pdf, y)
    y -= 22

    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(58, y, "Informacion de finalizacion")
    y -= 16
    pdf.setFont("Helvetica", 8)
    finalizado = (turno.get("fecha_hora_completado") or data.get("fecha_principal") or "")[:19].replace("T", " ")
    rows = [
        ("Fecha de finalizacion", finalizado),
        ("Estado", turno.get("estado_display") or "Completado"),
        ("Servicio", turno.get("servicio_nombre") or "-"),
        ("Profesional", turno.get("profesional_nombre") or "-"),
    ]
    for label, value in rows:
        pdf.drawString(70, y, f"{label}: {value}")
        y -= 13

    y -= 10
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawString(58, y, data["leyenda"])
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="comprobante_final_turno_{turno["id"]}.pdf"'
    return response


def _comprobante_pdf_response(data: dict):
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 42

    empresa = data["empresa"]
    turno = data["turno"]
    resumen = data["resumen"]

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(40, y, empresa["nombre_comercial"])
    pdf.setFont("Helvetica-Bold", 10)
    pdf.rect(385, y - 26, 170, 42)
    pdf.drawCentredString(470, y - 5, f"COMPROBANTE N {data['numero']}")
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(470, y - 20, f"Emision: {timezone.localtime().strftime('%d/%m/%Y %H:%M')}")
    y -= 18

    pdf.setFont("Helvetica", 8)
    for value in [empresa.get("direccion"), empresa.get("cuit") and f"CUIT: {empresa['cuit']}", empresa.get("telefono"), empresa.get("email")]:
        if value:
            pdf.drawString(40, y, str(value))
            y -= 12
    y -= 8
    _draw_line(pdf, y)
    y -= 26

    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawCentredString(width / 2, y, data["estado_comprobante"])
    y -= 14
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(width / 2, y, data["subtitulo"])
    y -= 24
    _draw_line(pdf, y)
    y -= 20

    if data["tipo"] == "pago":
        principal = data.get("pago_principal") or {}
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(40, y, "INFORMACION DEL PAGO")
        y -= 14
        rows = [
            ("Fecha de pago", (data.get("fecha_principal") or "")[:10]),
            ("Monto abonado", f"${data.get('monto_principal')}"),
            ("Metodo", principal.get("metodo_display") or "-"),
            ("Tipo", principal.get("tipo_display") or "-"),
            ("Referencia", principal.get("referencia") or "-"),
            ("Saldo pendiente", f"${resumen['saldo_pendiente']}"),
        ]
    else:
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(40, y, "INFORMACION DE FINALIZACION")
        y -= 14
        rows = [
            ("Cliente", turno["cliente_nombre"]),
            ("DNI", turno["cliente_dni"] or "-"),
            ("Fecha del turno", turno["fecha_hora"][:10] if turno["fecha_hora"] else "-"),
            ("Finalizado", (turno["fecha_hora_completado"] or data.get("fecha_principal") or "")[:10]),
            ("Estado", turno["estado_display"]),
            ("Total del servicio", f"${turno['precio_final']}"),
        ]

    for label, value in rows:
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(48, y, f"{label}:")
        pdf.setFont("Helvetica", 8)
        pdf.drawString(140, y, str(value))
        y -= 12

    y -= 10
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(40, y, "TURNO ASOCIADO" if data["tipo"] == "pago" else "SERVICIO REALIZADO")
    y -= 14
    pdf.setFont("Helvetica", 8)
    pdf.drawString(48, y, turno["servicio_nombre"])
    pdf.drawRightString(555, y, f"${turno['precio_final']}")
    y -= 22
    if data["tipo"] == "final":
        pdf.drawString(48, y, f"Profesional: {turno['profesional_nombre']}")
        pdf.drawRightString(555, y, f"Duracion: {turno['duracion_minutos']} min")
        y -= 22

    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(40, y, data["secciones"]["movimientos"].upper())
    y -= 14
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(48, y, "Fecha")
    pdf.drawString(145, y, "Tipo")
    pdf.drawString(245, y, "Metodo")
    pdf.drawString(390, y, "Referencia")
    pdf.drawRightString(555, y, "Monto")
    y -= 10
    _draw_line(pdf, y)
    y -= 12
    pdf.setFont("Helvetica", 8)
    for mov in data["movimientos"]:
        fecha = (mov["creado_en"] or "")[:10]
        pdf.drawString(48, y, fecha)
        pdf.drawString(145, y, mov["tipo_display"])
        pdf.drawString(245, y, mov["metodo_display"])
        pdf.drawString(390, y, (mov["referencia"] or "-")[:22])
        pdf.drawRightString(555, y, f"${mov['monto']}")
        y -= 12
        if y < 120:
            pdf.showPage()
            y = height - 50

    y -= 16
    _draw_line(pdf, y)
    y -= 18
    resumen_rows = [("Subtotal", resumen["subtotal"]), ("Monto abonado", resumen["monto_abonado"]), ("Saldo pendiente", resumen["saldo_pendiente"] )]
    if data["tipo"] == "final":
        resumen_rows = [("Total del servicio", resumen["subtotal"]), ("Total abonado", resumen["monto_abonado"]), ("Saldo al cierre", resumen["saldo_pendiente"])]
    for label, value in resumen_rows:
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(40, y, label)
        pdf.drawRightString(555, y, f"${value}")
        y -= 14

    y -= 8
    pdf.setFont("Helvetica", 8)
    pdf.drawString(40, y, data["mensaje"][:120])
    y -= 20
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawCentredString(width / 2, y, data["leyenda"])

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="comprobante_{data["tipo"]}_turno_{turno["id"]}.pdf"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def comprobante_pago_turno_pdf(request, turno_id: int):
    turno, error = _get_turno_o_error(request, turno_id)
    if error:
        return error
    if not turno.movimientos_pago.filter(estado="aprobado").exists() and not turno.pagos_mercadopago.filter(estado="approved").exists() and Decimal(str(turno.senia_pagada or 0)) <= Decimal("0.00"):
        return Response({"detail": "Este turno no tiene pagos registrados."}, status=status.HTTP_404_NOT_FOUND)
    return _comprobante_pago_pdf_response(_comprobante_data(turno, "pago"))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def comprobante_final_turno_pdf(request, turno_id: int):
    turno, error = _get_turno_o_error(request, turno_id)
    if error:
        return error
    if turno.estado != "completado":
        return Response({"detail": "El turno todavia no fue finalizado."}, status=status.HTTP_400_BAD_REQUEST)
    return _comprobante_final_pdf_response(_comprobante_data(turno, "final"))
