import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.users.models import User
from apps.clientes.models import Cliente
from apps.empleados.models import Empleado

# Buscar el usuario admin
try:
    admin_user = User.objects.get(email="admin@test.com")

    print(f"\n{'='*60}")
    print(f"👤 USUARIO: {admin_user.username}")
    print(f"{'='*60}")
    print(f"📧 Email: {admin_user.email}")
    print(f"🔑 Rol: {admin_user.role}")
    print(f"👨 Nombre: {admin_user.first_name} {admin_user.last_name}")
    print(f"🆔 DNI: {admin_user.dni}")
    print(f"⚙️  is_superuser: {admin_user.is_superuser}")
    print(f"👮 is_staff: {admin_user.is_staff}")
    print(f"✅ is_active: {admin_user.is_active}")

    # Verificar perfiles
    print(f"\n{'='*60}")
    print(f"PERFILES ASOCIADOS:")
    print(f"{'='*60}")

    # Cliente
    if hasattr(admin_user, "cliente_profile"):
        print(
            f"❌ PROBLEMA: Tiene perfil de Cliente (ID: {admin_user.cliente_profile.id})"
        )
    else:
        print(f"✅ NO tiene perfil de Cliente")

    # Empleado
    if hasattr(admin_user, "empleado_profile"):
        print(
            f"❌ PROBLEMA: Tiene perfil de Empleado (ID: {admin_user.empleado_profile.id})"
        )
    else:
        print(f"✅ NO tiene perfil de Empleado")

    print(f"\n{'='*60}")
    print(f"RECOMENDACIONES:")
    print(f"{'='*60}")

    issues = []
    if admin_user.role == "cliente":
        issues.append("⚠️  El rol debe ser 'propietario' o 'admin', no 'cliente'")

    if hasattr(admin_user, "cliente_profile"):
        issues.append("⚠️  Debe eliminar el perfil de Cliente")

    if hasattr(admin_user, "empleado_profile"):
        issues.append("⚠️  Debe eliminar el perfil de Empleado")

    if not admin_user.is_staff:
        issues.append("⚠️  Debe tener is_staff=True")

    if not admin_user.is_superuser:
        issues.append("⚠️  Debe tener is_superuser=True")

    if issues:
        for issue in issues:
            print(issue)
    else:
        print("✅ Todo está correcto!")

    print(f"\n")

except User.DoesNotExist:
    print("\n❌ No se encontró el usuario con email admin@test.com\n")
