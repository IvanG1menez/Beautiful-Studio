from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_movimientos_pago(apps, schema_editor):
    Turno = apps.get_model("turnos", "Turno")
    MovimientoPagoTurno = apps.get_model("turnos", "MovimientoPagoTurno")
    PagoMercadoPago = apps.get_model("mercadopago", "PagoMercadoPago")

    for pago in PagoMercadoPago.objects.filter(estado="approved").select_related("turno"):
        turno = pago.turno
        if MovimientoPagoTurno.objects.filter(
            turno_id=turno.id,
            referencia=str(pago.payment_id or pago.preference_id or ""),
            metodo="mercadopago",
        ).exists():
            continue
        tipo = "pago_completo" if getattr(turno, "tipo_pago", "") == "PAGO_COMPLETO" else "senia"
        MovimientoPagoTurno.objects.create(
            turno_id=turno.id,
            cliente_id=turno.cliente_id,
            monto=pago.monto,
            metodo="mercadopago_qr" if getattr(turno, "metodo_pago", "") == "mercadopago_qr" else "mercadopago",
            tipo=tipo,
            estado="aprobado",
            referencia=str(pago.payment_id or pago.preference_id or ""),
            descripcion=pago.descripcion or "Pago Mercado Pago historico",
            origen="backfill_mp",
            creado_en=pago.creado_en,
            actualizado_en=pago.actualizado_en,
        )

    turnos_con_senia = Turno.objects.filter(senia_pagada__gt=0).exclude(
        movimientos_pago__estado="aprobado"
    )
    for turno in turnos_con_senia:
        tipo = "pago_completo" if getattr(turno, "tipo_pago", "") == "PAGO_COMPLETO" else "senia"
        MovimientoPagoTurno.objects.create(
            turno_id=turno.id,
            cliente_id=turno.cliente_id,
            monto=turno.senia_pagada,
            metodo=turno.metodo_pago or "manual",
            tipo=tipo,
            estado="aprobado",
            referencia="historico",
            descripcion="Pago historico registrado en el turno",
            origen="backfill_turno",
            creado_en=turno.fecha_pago_registrado or turno.updated_at,
            actualizado_en=turno.updated_at,
        )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("clientes", "0004_billetera_fecha_vencimiento"),
        ("mercadopago", "0005_ordenmercadopagopresencial"),
        ("turnos", "0018_rename_turnos_logr_cliente_45d8a1_idx_turnos_logr_cliente_920ad3_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="MovimientoPagoTurno",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("monto", models.DecimalField(decimal_places=2, max_digits=10, verbose_name="Monto")),
                ("metodo", models.CharField(choices=[("mercadopago", "Mercado Pago"), ("mercadopago_qr", "Mercado Pago QR"), ("mercadopago_manual", "Mercado Pago manual"), ("efectivo", "Efectivo"), ("transferencia", "Transferencia"), ("billetera", "Billetera"), ("mixto", "Mixto"), ("manual", "Manual")], max_length=30)),
                ("tipo", models.CharField(choices=[("senia", "Seña"), ("saldo", "Saldo"), ("pago_completo", "Pago completo"), ("ajuste", "Ajuste")], max_length=20)),
                ("estado", models.CharField(choices=[("aprobado", "Aprobado"), ("pendiente", "Pendiente"), ("cancelado", "Cancelado")], default="aprobado", max_length=20)),
                ("referencia", models.CharField(blank=True, default="", max_length=255)),
                ("descripcion", models.CharField(blank=True, default="", max_length=255)),
                ("origen", models.CharField(blank=True, default="", max_length=40)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                ("cliente", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="movimientos_pago_turnos", to="clientes.cliente", verbose_name="Cliente")),
                ("registrado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="movimientos_pago_registrados", to=settings.AUTH_USER_MODEL)),
                ("turno", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movimientos_pago", to="turnos.turno", verbose_name="Turno")),
            ],
            options={
                "verbose_name": "Movimiento de Pago de Turno",
                "verbose_name_plural": "Movimientos de Pago de Turnos",
                "ordering": ["creado_en", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="movimientopagoturno",
            index=models.Index(fields=["turno", "estado", "creado_en"], name="turnos_movi_turno_i_0c94a8_idx"),
        ),
        migrations.AddIndex(
            model_name="movimientopagoturno",
            index=models.Index(fields=["referencia"], name="turnos_movi_referen_b85bb0_idx"),
        ),
        migrations.RunPython(backfill_movimientos_pago, migrations.RunPython.noop),
    ]
