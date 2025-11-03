from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom User model extending AbstractUser
    """

    ROLE_CHOICES = [
        ("admin", "Administrador"),
        ("empleado", "Empleado"),
        ("cliente", "Cliente"),
        ("profesional", "Profesional"),
        ("propietario", "Propietario"),
        ("superusuario", "Superusuario"),
    ]

    email = models.EmailField(unique=True)
    dni = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="DNI/Documento",
        help_text="Documento Nacional de Identidad o equivalente",
    )
    phone = models.CharField(
        max_length=20, blank=True, null=True, verbose_name="Teléfono"
    )
    role = models.CharField(
        max_length=15, choices=ROLE_CHOICES, default="cliente", verbose_name="Rol"
    )
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="Fecha de creación"
    )
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="Fecha de actualización"
    )

    """El campo 'username' sigue siendo obligatorio en AbstractUser"""
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def is_admin(self):
        return self.role == "admin"

    def is_empleado(self):
        return self.role == "empleado"

    def is_cliente(self):
        return self.role == "cliente"
