import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("mercadopago", "0002_initial"),
        ("turnos", "0013_solicitudreprogramacionflexible_expires_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pagomercadopago",
            name="turno",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="pagos_mercadopago",
                to="turnos.turno",
                verbose_name="Turno",
            ),
        ),
    ]
