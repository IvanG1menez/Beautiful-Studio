# Generated manually on 2026-05-15

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("servicios", "0005_historicalservicio_bono_reacomodamiento_pago_completo_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="historicalservicio",
            name="permite_reacomodamiento",
        ),
        migrations.RemoveField(
            model_name="servicio",
            name="permite_reacomodamiento",
        ),
    ]
