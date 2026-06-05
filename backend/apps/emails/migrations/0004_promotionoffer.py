import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0001_initial"),
        ("empleados", "0001_initial"),
        ("servicios", "0001_initial"),
        ("turnos", "0001_initial"),
        ("emails", "0003_alter_notificacion_tipo_accesstoken"),
    ]

    operations = [
        migrations.CreateModel(
            name="PromotionOffer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("campaign_id", models.UUIDField(db_index=True, default=uuid.uuid4)),
                ("fecha_hora", models.DateTimeField()),
                ("beneficio", models.CharField(choices=[("wallet", "Saldo en billetera"), ("discount", "Descuento")], max_length=20)),
                ("saldo_snapshot", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("status", models.CharField(choices=[("sent", "Enviada"), ("accepted", "Aceptada"), ("payment_pending", "Pago pendiente"), ("taken_by_other", "Tomada por otro cliente"), ("expired", "Expirada"), ("cancelled", "Cancelada")], default="sent", max_length=20)),
                ("expires_at", models.DateTimeField()),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                ("payment_preference_id", models.CharField(blank=True, default="", max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cliente", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="promotion_offers", to="clientes.cliente")),
                ("empleado", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="promotion_offers", to="empleados.empleado")),
                ("servicio", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="promotion_offers", to="servicios.servicio")),
                ("turno", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="promotion_offers", to="turnos.turno")),
            ],
            options={
                "verbose_name": "Oferta Promocional",
                "verbose_name_plural": "Ofertas Promocionales",
                "db_table": "emails_promotionoffer",
                "ordering": ["-created_at"],
                "indexes": [models.Index(fields=["token"], name="emails_prom_token_914ebe_idx"), models.Index(fields=["campaign_id", "status"], name="emails_prom_campaig_9396b5_idx"), models.Index(fields=["cliente", "-created_at"], name="emails_prom_cliente_fa2221_idx")],
            },
        ),
    ]
