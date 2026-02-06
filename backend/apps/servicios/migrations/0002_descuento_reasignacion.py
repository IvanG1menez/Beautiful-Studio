from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("servicios", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicio",
            name="descuento_reasignacion",
            field=models.DecimalField(
                max_digits=10,
                decimal_places=2,
                default=0,
                verbose_name="Descuento por reasignación",
                help_text="Descuento fijo a aplicar cuando se ofrece un adelanto de turno",
            ),
        ),
    ]
