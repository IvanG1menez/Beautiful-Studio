from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0005_configuracionglobal_horas_vencimiento_reprogramacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionglobal",
            name="max_reprogramaciones_mensuales",
            field=models.IntegerField(
                default=1,
                help_text="Cantidad maxima de reprogramaciones mensuales por cliente y servicio",
                validators=[django.core.validators.MinValueValidator(1)],
                verbose_name="Numero de reprogramaciones mensuales",
            ),
        ),
    ]
