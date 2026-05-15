from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("mercadopago", "0004_preferenciamercadopagocancelada"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrdenMercadoPagoPresencial",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference_id", models.CharField(max_length=255, unique=True)),
                ("payload", models.JSONField()),
                ("qr_data", models.TextField(blank=True)),
                ("monto", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "estado",
                    models.CharField(
                        choices=[("pending", "Pendiente"), ("approved", "Aprobada"), ("cancelled", "Cancelada")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("payment_id", models.CharField(blank=True, max_length=255, null=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Orden Mercado Pago presencial",
                "verbose_name_plural": "Órdenes Mercado Pago presenciales",
                "ordering": ["-creado_en"],
            },
        ),
    ]
