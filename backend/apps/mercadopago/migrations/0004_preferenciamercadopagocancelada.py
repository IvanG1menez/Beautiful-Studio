from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("mercadopago", "0003_pago_turno_foreignkey"),
    ]

    operations = [
        migrations.CreateModel(
            name="PreferenciaMercadoPagoCancelada",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("preference_id", models.CharField(max_length=255, unique=True)),
                ("motivo", models.CharField(blank=True, max_length=255)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "cancelado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="preferencias_mp_canceladas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Preferencia Mercado Pago cancelada",
                "verbose_name_plural": "Preferencias Mercado Pago canceladas",
            },
        ),
    ]
