from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0001_initial"),
        ("telegram_bot", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TelegramLinkToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(db_index=True, max_length=96, unique=True)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="telegram_link_tokens",
                        to="clientes.cliente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Telegram Link Token",
                "verbose_name_plural": "Telegram Link Tokens",
                "ordering": ["-created_at"],
            },
        ),
    ]
