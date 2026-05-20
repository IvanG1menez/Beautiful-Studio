from django.db import models
from django.utils import timezone


class TelegramLink(models.Model):
    telegram_user_id = models.BigIntegerField(unique=True)
    chat_id = models.BigIntegerField(db_index=True)
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="telegram_links",
    )
    phone_snapshot = models.CharField(max_length=32, blank=True, default="")
    is_verified = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Telegram Link"
        verbose_name_plural = "Telegram Links"

    def __str__(self):
        return f"Telegram {self.telegram_user_id}"


class TelegramLinkToken(models.Model):
    token = models.CharField(max_length=96, unique=True, db_index=True)
    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="telegram_link_tokens",
    )
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Telegram Link Token"
        verbose_name_plural = "Telegram Link Tokens"
        ordering = ["-created_at"]

    @property
    def is_used(self):
        return self.used_at is not None

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"Token Telegram cliente #{self.cliente_id}"


class TelegramUpdateLog(models.Model):
    update_id = models.BigIntegerField(unique=True)
    payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Telegram Update Log"
        verbose_name_plural = "Telegram Update Logs"

    def __str__(self):
        return f"Update {self.update_id}"


class TelegramConversationState(models.Model):
    STATE_IDLE = "idle"
    STATE_CONFIRM_CANCEL = "confirm_cancel"
    STATE_ENDED = "ended"

    STATE_CHOICES = [
        (STATE_IDLE, "Idle"),
        (STATE_CONFIRM_CANCEL, "Confirm Cancel"),
        (STATE_ENDED, "Ended"),
    ]

    link = models.OneToOneField(
        TelegramLink,
        on_delete=models.CASCADE,
        related_name="conversation_state",
    )
    state = models.CharField(max_length=32, choices=STATE_CHOICES, default=STATE_IDLE)
    pending_turno_id = models.PositiveIntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telegram Conversation State"
        verbose_name_plural = "Telegram Conversation States"

    def __str__(self):
        return f"State {self.link_id} - {self.state}"
