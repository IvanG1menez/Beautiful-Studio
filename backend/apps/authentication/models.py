from typing import Any
import json
from django.db import models
from django.contrib.auth import get_user_model


# Obtener el modelo de usuario personalizado
User = get_user_model()


class PermisoAdicional(models.Model):
    """
    Modelo para gestionar permisos adicionales específicos del negocio
    """

    TIPO_PERMISO_CHOICES = [
        ("ver_reportes", "Ver Reportes"),
        ("gestionar_precios", "Gestionar Precios"),
        ("gestionar_horarios", "Gestionar Horarios"),
        ("ver_todos_turnos", "Ver Todos los Turnos"),
        ("cancelar_turnos", "Cancelar Turnos"),
        ("gestionar_promociones", "Gestionar Promociones"),
        ("acceso_caja", "Acceso a Caja"),
        ("gestionar_inventario", "Gestionar Inventario"),
    ]

    nombre = models.CharField(max_length=50, choices=TIPO_PERMISO_CHOICES, unique=True)
    descripcion = models.TextField()
    activo = models.BooleanField(default=True)
    usuarios = models.ManyToManyField(
        User, related_name="permisos_adicionales", blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Permiso Adicional"
        verbose_name_plural = "Permisos Adicionales"
        ordering = ["nombre"]

    def __str__(self) -> str:
        return getattr(self, "get_nombre_display", lambda: str(self.nombre))()


class Configuracion(models.Model):
    """
    Modelo para configuraciones generales del sistema
    """

    clave = models.CharField(max_length=100, unique=True)
    valor = models.TextField()
    descripcion = models.TextField(blank=True, null=True)
    tipo_dato = models.CharField(
        max_length=20,
        choices=[
            ("str", "Texto"),
            ("int", "Entero"),
            ("float", "Decimal"),
            ("bool", "Booleano"),
            ("json", "JSON"),
        ],
        default="str",
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración"
        verbose_name_plural = "Configuraciones"
        ordering = ["clave"]

    def __str__(self) -> str:
        return f"{self.clave}: {self.valor}"

    def get_valor_parsed(self) -> Any:
        """
        Devuelve el valor parseado según el tipo de dato
        """
        if not self.valor:
            return None

        if self.tipo_dato == "int":
            return int(self.valor)
        elif self.tipo_dato == "float":
            return float(self.valor)
        elif self.tipo_dato == "bool":
            return str(self.valor).lower() in ["true", "1", "yes", "on"]
        elif self.tipo_dato == "json":
            return json.loads(self.valor)
        return self.valor


class AuditoriaAcciones(models.Model):
    """
    Modelo para auditoría de acciones importantes del sistema
    """

    ACCION_CHOICES = [
        ("crear", "Crear"),
        ("editar", "Editar"),
        ("eliminar", "Eliminar"),
        ("login", "Inicio de Sesión"),
        ("logout", "Cierre de Sesión"),
        ("cambio_password", "Cambio de Contraseña"),
        ("cambio_rol", "Cambio de Rol"),
        ("backup", "Backup"),
        ("restaurar", "Restaurar"),
    ]

    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acciones_auditoria",
    )
    accion = models.CharField(max_length=20, choices=ACCION_CHOICES)
    modelo_afectado = models.CharField(max_length=100, blank=True, null=True)
    objeto_id = models.PositiveIntegerField(blank=True, null=True)
    detalles = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Auditoría de Acción"
        verbose_name_plural = "Auditoría de Acciones"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        usuario_str = (
            getattr(self.usuario, "username", "Sistema") if self.usuario else "Sistema"
        )
        accion_display = getattr(self, "get_accion_display", lambda: str(self.accion))()
        return f"{usuario_str} - {accion_display} - " f"{self.created_at}"


class ConfiguracionSSO(models.Model):
    """
    Modelo para configuración de Google SSO
    Singleton - Solo debe existir un registro
    """
    
    google_sso_activo = models.BooleanField(
        default=True,
        verbose_name="Google SSO Activo",
        help_text="Activar/desactivar inicio de sesión con Google"
    )
    
    autocreacion_cliente_sso = models.BooleanField(
        default=True,
        verbose_name="Auto-creación de Cliente SSO",
        help_text="Crear automáticamente perfil de Cliente para usuarios que se registren con Google"
    )
    
    client_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Google Client ID",
        help_text="Client ID de Google Cloud Console"
    )
    
    client_secret = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Google Client Secret",
        help_text="Client Secret de Google Cloud Console"
    )
    
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración SSO"
        verbose_name_plural = "Configuración SSO"

    def __str__(self) -> str:
        status = "Activo" if self.google_sso_activo else "Inactivo"
        return f"Configuración SSO - {status}"

    @classmethod
    def get_config(cls):
        """
        Método para obtener o crear la configuración (Singleton)
        """
        config, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'google_sso_activo': True,
                'autocreacion_cliente_sso': True,
                'activo': True
            }
        )
        return config
    
    def save(self, *args, **kwargs):
        """
        Override save para asegurar que solo exista un registro
        """
        self.pk = 1
        super().save(*args, **kwargs)
