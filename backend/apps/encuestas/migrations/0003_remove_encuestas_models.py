from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("encuestas", "0002_initial"),
    ]

    operations = [
        # Eliminar primero las dependencias (respuestas) y luego las demás tablas de encuestas
        migrations.DeleteModel(
            name="RespuestaCliente",
        ),
        migrations.DeleteModel(
            name="EncuestaPregunta",
        ),
        migrations.DeleteModel(
            name="Encuesta",
        ),
        migrations.DeleteModel(
            name="EncuestaConfig",
        ),
    ]
