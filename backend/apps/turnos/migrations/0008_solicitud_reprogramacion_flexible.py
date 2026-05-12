from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0007_pa3_streak_models"),
        ("clientes", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SolicitudReprogramacionFlexible",
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
                    "motivo",
                    models.TextField(blank=True, null=True, verbose_name="Motivo"),
                ),
                (
                    "preferencia_fecha",
                    models.DateField(
                        blank=True,
                        null=True,
                        verbose_name="Fecha preferida",
                    ),
                ),
                (
                    "preferencia_horario",
                    models.CharField(
                        blank=True,
                        max_length=20,
                        null=True,
                        verbose_name="Horario preferido",
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("en_revision", "En revisión"),
                            ("atendida", "Atendida"),
                            ("rechazada", "Rechazada"),
                            ("cancelada", "Cancelada"),
                        ],
                        default="pendiente",
                        max_length=20,
                        verbose_name="Estado",
                    ),
                ),
                (
                    "requiere_senia_nueva",
                    models.BooleanField(default=False, verbose_name="Requiere seña nueva"),
                ),
                (
                    "observaciones",
                    models.TextField(
                        blank=True,
                        null=True,
                        verbose_name="Observaciones",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Fecha de actualización"),
                ),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="solicitudes_reprogramacion_flexible",
                        to="clientes.cliente",
                        verbose_name="Cliente",
                    ),
                ),
                (
                    "turno",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="solicitudes_flexibles",
                        to="turnos.turno",
                        verbose_name="Turno",
                    ),
                ),
            ],
            options={
                "verbose_name": "Solicitud de Reprogramación Flexible",
                "verbose_name_plural": "Solicitudes de Reprogramación Flexible",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="solicitudreprogramacionflexible",
            index=models.Index(fields=["estado", "-created_at"], name="turnos_sol_estado_d0f2a5_idx"),
        ),
        migrations.AddIndex(
            model_name="solicitudreprogramacionflexible",
            index=models.Index(fields=["turno", "estado"], name="turnos_sol_turno_e0bcd9_idx"),
        ),
    ]
