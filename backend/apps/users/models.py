from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """
    Custom user manager que maneja la creación de usuarios con username opcional
    """
    
    def _create_user(self, email, password=None, **extra_fields):
        """
        Crea y guarda un usuario con el email dado
        """
        if not email:
            raise ValueError('El email debe ser proporcionado')
        
        email = self.normalize_email(email)
        
        # Si no se proporciona username, generarlo desde el email
        if 'username' not in extra_fields or not extra_fields.get('username'):
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            
            # Asegurar que el username sea único
            while self.model.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            extra_fields['username'] = username
        
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_user(self, email=None, password=None, **extra_fields):
        """
        Crea un usuario normal
        """
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)
    
    def create_superuser(self, email, password=None, **extra_fields):
        """
        Crea un superusuario
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'superusuario')
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom User model extending AbstractUser
    """

    ROLE_CHOICES = [
        ("propietario", "Propietario"),
        ("profesional", "Profesional"),
        ("cliente", "Cliente"),
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
    
    # Usar el manager personalizado
    objects = UserManager()

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def is_propietario(self):
        return self.role == "propietario" or self.role == "superusuario"

    def is_profesional(self):
        return self.role == "profesional"

    def is_cliente(self):
        return self.role == "cliente"
