from django.contrib import admin

from .models import TelegramLink, TelegramUpdateLog, TelegramConversationState


@admin.register(TelegramLink)
class TelegramLinkAdmin(admin.ModelAdmin):
    list_display = ("telegram_user_id", "chat_id", "cliente", "is_verified", "last_seen_at")
    search_fields = ("telegram_user_id", "chat_id", "phone_snapshot", "cliente__user__email")
    list_filter = ("is_verified",)


@admin.register(TelegramUpdateLog)
class TelegramUpdateLogAdmin(admin.ModelAdmin):
    list_display = ("update_id", "processed", "created_at", "processed_at")
    list_filter = ("processed",)
    search_fields = ("update_id",)


@admin.register(TelegramConversationState)
class TelegramConversationStateAdmin(admin.ModelAdmin):
    list_display = ("link", "state", "pending_turno_id", "updated_at")
    list_filter = ("state",)
