from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("clientes", "0001_initial"),
        ("turnos", "0006_historicalturno_tipo_pago_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClienteStreakStats",
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
                    "streak_count",
                    models.PositiveIntegerField(default=0, verbose_name="Racha actual"),
                ),
                (
                    "last_completed_at",
                    models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="Fecha último completado",
                    ),
                ),
                (
                    "next_expiration_at",
                    models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="Próximo vencimiento de racha",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.OneToOneField(
                        on_delete=models.deletion.CASCADE,
                        related_name="streak_stats",
                        to="clientes.cliente",
                        verbose_name="Cliente",
                    ),
                ),
                (
                    "last_completed_turno",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="+",
                        to="turnos.turno",
                        verbose_name="Último turno completado",
                    ),
                ),
            ],
            options={
                "verbose_name": "Estadística de Racha",
                "verbose_name_plural": "Estadísticas de Racha",
            },
        ),
        migrations.CreateModel(
            name="StreakAuditLog",
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
                    "accion",
                    models.CharField(
                        choices=[
                            ("insercion", "Inserción"),
                            ("modificacion", "Modificación"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("streak_counter", "Contador de racha"),
                            ("streak_bonus", "Bono de racha"),
                        ],
                        max_length=30,
                    ),
                ),
                ("valor_anterior", models.JSONField(blank=True, null=True)),
                ("valor_posterior", models.JSONField(blank=True, null=True)),
                ("detalle", models.CharField(blank=True, default="", max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="streak_audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="streak_audit_logs",
                        to="clientes.cliente",
                    ),
                ),
                (
                    "turno",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="streak_audit_logs",
                        to="turnos.turno",
                    ),
                ),
            ],
            options={
                "verbose_name": "Auditoría PA3",
                "verbose_name_plural": "Auditoría PA3",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="StreakExpiryAlertLog",
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
                ("threshold_days", models.PositiveSmallIntegerField(verbose_name="Umbral de días")),
                (
                    "expiration_date_reference",
                    models.DateField(verbose_name="Fecha de vencimiento"),
                ),
                ("channels_sent", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="streak_expiry_alerts",
                        to="clientes.cliente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Log alerta vencimiento racha",
                "verbose_name_plural": "Logs alerta vencimiento racha",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="StreakRewardEvent",
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
                ("milestone_number", models.PositiveIntegerField(verbose_name="Hito alcanzado")),
                ("streak_before", models.PositiveIntegerField(default=0)),
                ("streak_after", models.PositiveIntegerField(default=0)),
                (
                    "bonus_amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=10),
                ),
                (
                    "applied_discount_amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=10,
                        verbose_name="Descuento aplicado",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("aplicado", "Aplicado"),
                            ("saltado_prioridad", "Saltado por prioridad"),
                            ("revertido", "Revertido"),
                        ],
                        max_length=24,
                    ),
                ),
                ("reason", models.CharField(blank=True, default="", max_length=100)),
                ("valor_anterior", models.JSONField(blank=True, null=True)),
                ("valor_posterior", models.JSONField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="streak_reward_events",
                        to="clientes.cliente",
                    ),
                ),
                (
                    "turno",
                    models.ForeignKey(
                        on_delete=models.deletion.PROTECT,
                        related_name="streak_reward_events",
                        to="turnos.turno",
                    ),
                ),
            ],
            options={
                "verbose_name": "Evento de Bono por Racha",
                "verbose_name_plural": "Eventos de Bono por Racha",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="streakexpiryalertlog",
            constraint=models.UniqueConstraint(
                fields=("cliente", "threshold_days", "expiration_date_reference"),
                name="unique_streak_expiry_alert",
            ),
        ),
        migrations.AddConstraint(
            model_name="streakrewardevent",
            constraint=models.UniqueConstraint(
                fields=("turno", "milestone_number"),
                name="unique_streak_reward_per_turno_milestone",
            ),
        ),
    ]
