"""Señales para la app de clientes"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from .models import Cliente


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_cliente_profile(instance, created):
    """
    Crea automáticamente un perfil de cliente cuando se crea un usuario
    con rol 'cliente'
    """
    if created and hasattr(instance, "role") and instance.role == "cliente":
        Cliente.objects.create(user=instance)  # type: ignore


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_cliente_profile(instance):  # noqa: ARG001
    """
    Guarda el perfil de cliente cuando se actualiza el usuario
    """
    if hasattr(instance, "role") and instance.role == "cliente":
        # Crear el perfil si no existe
        if not hasattr(instance, "cliente_profile"):
            Cliente.objects.create(user=instance)  # type: ignore
        else:
            # Guardar el perfil existente
            instance.cliente_profile.save()
