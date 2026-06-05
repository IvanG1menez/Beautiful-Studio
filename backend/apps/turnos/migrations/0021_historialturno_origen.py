from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0020_rename_turnos_movi_turno_i_0c94a8_idx_turnos_movi_turno_i_0982a8_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="historialturno",
            name="origen",
            field=models.CharField(
                blank=True,
                default="panel",
                max_length=40,
                verbose_name="Origen del cambio",
            ),
        ),
    ]
