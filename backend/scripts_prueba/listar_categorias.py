"""
Script para listar categorías de servicios
"""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.servicios.models import CategoriaServicio

categorias = CategoriaServicio.objects.all()
print(f"\nCategorías de servicios ({categorias.count()}):")
for cat in categorias:
    print(f"  {cat.id}: {cat.nombre}")
