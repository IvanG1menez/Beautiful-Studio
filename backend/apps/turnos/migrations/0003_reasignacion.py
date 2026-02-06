import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0002_initial"),
        ("clientes", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="turno",
            name="senia_pagada",
            field=models.DecimalField(
                max_digits=10,
                decimal_places=2,
                default=0,
                verbose_name="Seña pagada",
                help_text="Monto de seña ya abonada por el cliente",
            ),
        ),
        migrations.CreateModel(
            name="LogReasignacion",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "monto_descuento",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=10,
                        verbose_name="Monto de descuento",
                    ),
                ),
                (
                    "token",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        unique=True,
                        verbose_name="Token",
                    ),
                ),
                (
                    "fecha_envio",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="Fecha de envío"
                    ),
                ),
                ("expires_at", models.DateTimeField(verbose_name="Expira")),
                (
                    "estado_final",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("aceptada", "Aceptada"),
                            ("rechazada", "Rechazada"),
                            ("expirada", "Expirada"),
                        ],
                        max_length=20,
                        null=True,
                        verbose_name="Estado final",
                    ),
                ),
                (
                    "cliente_notificado",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="reasignaciones_notificadas",
                        to="clientes.cliente",
                        verbose_name="Cliente notificado",
                    ),
                ),
                (
                    "turno_cancelado",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="reasignaciones_cancelado",
                        to="turnos.turno",
                        verbose_name="Turno cancelado",
                    ),
                ),
                (
                    "turno_ofrecido",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.SET_NULL,
                        related_name="reasignaciones_ofrecido",
                        to="turnos.turno",
                        verbose_name="Turno ofrecido",
                    ),
                ),
            ],
            options={
                "verbose_name": "Log de Reasignación",
                "verbose_name_plural": "Logs de Reasignación",
                "ordering": ["-fecha_envio"],
            },
        ),
        migrations.AddIndex(
            model_name="logreasignacion",
            index=models.Index(fields=["token"], name="turnos_logre_token_4d857a_idx"),
        ),
        migrations.AddIndex(
            model_name="logreasignacion",
            index=models.Index(
                fields=["estado_final", "-fecha_envio"],
                name="turnos_logre_estado__15b8f3_idx",
            ),
        ),
    ]
