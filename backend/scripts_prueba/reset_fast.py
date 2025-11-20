"""
Resetear contraseñas RÁPIDO - solo profesionales y clientes
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User

print("\n🔄 Reseteando contraseñas...\n")

# Resetear profesionales
profesionales = User.objects.filter(role='profesional')
for user in profesionales:
    user.set_password('profesional123')
    user.save()
print(f"✅ {profesionales.count()} profesionales - Contraseña: profesional123")

# Resetear clientes
clientes = User.objects.filter(role='cliente')
for user in clientes:
    user.set_password('cliente123')
    user.save()
print(f"✅ {clientes.count()} clientes - Contraseña: cliente123")

# Resetear propietarios
propietarios = User.objects.filter(role='propietario')
for user in propietarios:
    user.set_password('admin123')
    user.save()
print(f"✅ {propietarios.count()} propietarios - Contraseña: admin123")

print("\n" + "="*60)
print("✅✅✅ TODAS LAS CONTRASEÑAS RESETEADAS ✅✅✅")
print("="*60)
print("\nCREDENCIALES POR ROL:")
print("  • Profesionales: profesional123")
print("  • Clientes: cliente123")
print("  • Propietarios: admin123")
print("\n" + "="*60 + "\n")
