from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("servicios", "0006_remove_servicio_permite_reacomodamiento_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="sala",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Activo"),
        ),
        migrations.AddField(
            model_name="historicalsala",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="Activo"),
        ),
    ]
