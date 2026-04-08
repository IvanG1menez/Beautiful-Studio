from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionglobal",
            name="dias_vencimiento_credito",
            field=models.IntegerField(
                default=90,
                help_text="Cantidad de días que dura vigente el crédito en billetera (mínimo 30)",
                validators=[django.core.validators.MinValueValidator(30)],
                verbose_name="Días de vigencia del crédito",
            ),
        ),
    ]
