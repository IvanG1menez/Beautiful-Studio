#!/usr/bin/env python
import os
import sys

# Agregar el directorio del proyecto al path
sys.path.insert(0, os.path.dirname(__file__))

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'beautiful_studio_backend.settings')

import django
django.setup()

from apps.turnos.models import Turno

# Buscar turnos con notas
turnos = Turno.objects.filter(notas_cliente__isnull=False).exclude(notas_cliente='')

print(f'Total de turnos con notas: {turnos.count()}')
print('\nPrimeros 15 turnos con notas:')
for t in turnos[:15]:
    notas = t.notas_cliente or ''
    print(f'ID: {t.id}, Notas: [{notas}] (longitud={len(notas)})')

# Buscar específicamente notas cortas
print('\n\n=== Buscando notas de 1-3 caracteres ===')
turnos_cortos = Turno.objects.filter(
    notas_cliente__isnull=False
).exclude(notas_cliente='')

for t in turnos_cortos:
    if t.notas_cliente and len(t.notas_cliente) <= 3:
        print(f'ID: {t.id}, Notas cortas: [{t.notas_cliente}] (len={len(t.notas_cliente)})')
