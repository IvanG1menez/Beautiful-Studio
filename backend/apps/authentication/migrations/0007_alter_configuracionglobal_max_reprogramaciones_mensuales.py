from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0006_configuracionglobal_max_reprogramaciones_mensuales"),
    ]

    operations = [
        migrations.AlterField(
            model_name="configuracionglobal",
            name="max_reprogramaciones_mensuales",
            field=models.IntegerField(
                default=1,
                help_text="Cantidad maxima de reprogramaciones mensuales por cliente y servicio",
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(5),
                ],
                verbose_name="Numero de reprogramaciones mensuales",
            ),
        ),
    ]
