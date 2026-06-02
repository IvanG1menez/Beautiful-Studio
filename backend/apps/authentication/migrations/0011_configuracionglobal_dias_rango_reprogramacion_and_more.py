from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0010_alter_configuracionglobal_streak_bonus_amount"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="configuracionglobal",
            name="max_reprogramaciones_mensuales",
        ),
        migrations.AddField(
            model_name="configuracionglobal",
            name="dias_rango_reprogramacion",
            field=models.IntegerField(
                choices=[(7, "7 días"), (14, "14 días")],
                default=14,
                help_text="Cantidad de días hacia adelante en los que el cliente puede elegir un nuevo turno",
                validators=[MinValueValidator(7), MaxValueValidator(14)],
                verbose_name="Rango de reprogramación",
            ),
        ),
    ]
