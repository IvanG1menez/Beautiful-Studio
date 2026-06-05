import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0018_rename_turnos_logr_cliente_45d8a1_idx_turnos_logr_cliente_920ad3_idx_and_more"),
        ("emails", "0005_promotionoffer_payment_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="promotionoffer",
            name="process_type",
            field=models.CharField(
                choices=[
                    ("fidelizacion", "Fidelización"),
                    ("reacomodamiento", "Reacomodamiento"),
                ],
                default="fidelizacion",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="promotionoffer",
            name="reasignacion_log",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="promotion_offers",
                to="turnos.logreasignacion",
            ),
        ),
        migrations.AddField(
            model_name="promotionoffer",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="promotionoffer",
            name="status",
            field=models.CharField(
                choices=[
                    ("sent", "Enviada"),
                    ("accepted", "Aceptada"),
                    ("rejected", "Rechazada"),
                    ("payment_pending", "Pago pendiente"),
                    ("taken_by_other", "Tomada por otro cliente"),
                    ("expired", "Expirada"),
                    ("cancelled", "Cancelada"),
                ],
                default="sent",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="promotionoffer",
            index=models.Index(fields=["process_type", "status"], name="emails_prom_process_f44750_idx"),
        ),
    ]
