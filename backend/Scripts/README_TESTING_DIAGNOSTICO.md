# 🧪 Scripts de Testing para Herramientas de Diagnóstico

Este directorio contiene scripts para probar los procesos automáticos de diagnóstico del sistema Beautiful Studio.

## 📋 Scripts Disponibles

### 1. `test_optimizacion_agenda.py`

**Propósito:** Crea datos para probar el Proceso 2 (Optimización de Agenda)

**Datos creados:**

- ✅ 2 clientes de prueba
- ✅ 1 servicio con `permite_reacomodamiento=True`
- ✅ 1 turno futuro confirmado (a cancelar)
- ✅ 1 turno posterior del mismo servicio (candidato)

**Flujo de testing:**

1. Cancela un turno
2. Acredita billetera del cliente (si cumple horas mínimas)
3. Busca candidato para rellenar el hueco
4. Envía propuesta de adelanto

### 2. `test_fidelizacion_clientes.py`

**Propósito:** Crea datos para probar el Proceso 1 (Fidelización de Clientes)

**Datos creados:**

- ✅ 4 clientes inactivos con diferentes niveles de abandono
- ✅ 3 servicios con frecuencias personalizadas (30, 60 días, y global)
- ✅ Turnos completados hace 45-90 días

**Casos de prueba:**

- Cliente 1: 45 días inactivo → Supera frecuencia de 30 días
- Cliente 2: 70 días inactivo → Supera frecuencia de 60 días
- Cliente 3: 75 días inactivo → Supera configuración global
- Cliente 4: 90 días inactivo → Cliente muy abandonado

### 3. `limpiar_tests_diagnostico.py`

**Propósito:** Elimina TODOS los datos creados por los scripts anteriores

**Elimina:**

- ❌ Usuarios de testing (`test_opt_*`, `test_fid_*`)
- ❌ Perfiles de cliente asociados
- ❌ Turnos y su historial
- ❌ Billeteras y movimientos
- ❌ Servicios de testing
- ❌ Categorías de testing

---

## 🚀 Uso Rápido

### Preparar ambiente

Asegúrate de tener el entorno virtual activado:

```bash
cd backend
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# o
source venv/bin/activate     # Linux/Mac
```

### Testing de Optimización de Agenda

```bash
# 1. Crear datos de prueba
python Scripts/test_optimizacion_agenda.py

# 2. Copiar el ID del turno que aparece en el output
# Ejemplo: 🎯 ID del turno a usar en testing: 123

# 3. Ir a: http://localhost:3000/dashboard/propietario/diagnostico

# 4. En "Optimización de Agenda":
#    - Ingresar el turno ID
#    - Click en "Gatillar Optimización de Agenda"

# 5. Verificar logs:
#    ✓ Paso 1: Turno cancelado
#    ✓ Paso 2: Crédito acreditado
#    ✓ Paso 3: Propuesta enviada al candidato
```

### Testing de Fidelización de Clientes

```bash
# 1. Crear datos de prueba
python Scripts/test_fidelizacion_clientes.py

# 2. Ir a: http://localhost:3000/dashboard/propietario/diagnostico

# 3. En "Fidelización de Clientes":
#    - Dejar "Días de inactividad" vacío (usa lógica automática)
#    - Mantener "Enviar emails reales" desactivado
#    - Click en "Gatillar Fidelización de Clientes"

# 4. Verificar resultados:
#    📊 4 candidatos identificados
#    ✅ Lista con nombres, emails, días inactivos
#    💰 Precios con descuento aplicado
```

### Limpiar y reiniciar

```bash
# Eliminar todos los datos de testing
python Scripts/limpiar_tests_diagnostico.py

# Confirmar con: SI
```

---

## 🎯 Casos de Prueba Avanzados

### Optimización: Probar diferentes escenarios

```bash
# Caso 1: Turno sin cliente → No acredita billetera
# Editar manualmente el turno y quitar el cliente

# Caso 2: Turno con <48hs de anticipación → No acredita
# Crear turno para mañana en lugar de 5 días

# Caso 3: Servicio sin reacomodamiento → No busca candidatos
# Cambiar servicio.permite_reacomodamiento = False
```

### Fidelización: Probar filtros manuales

```bash
# Caso 1: Filtro de 40 días
# En la UI: Ingresar "40" en "Días de inactividad"
# Resultado: Solo clientes con >40 días inactivos

# Caso 2: Filtro de 80 días
# En la UI: Ingresar "80"
# Resultado: Solo Cliente 4 (90 días) aparece

# Caso 3: Envío real de emails (¡CUIDADO!)
# En la UI: Activar "Enviar emails reales"
# Nota: Esto enviará emails reales a las direcciones de prueba
```

---

## 📊 Datos Técnicos

### IDs de usuarios creados

**Optimización:**

- `test_opt_cliente1@test.com` → Tiene el turno a cancelar
- `test_opt_cliente2@test.com` → Candidato a recibir propuesta

**Fidelización:**

- `test_fid_cliente1@test.com` → 45 días inactivo
- `test_fid_cliente2@test.com` → 70 días inactivo
- `test_fid_cliente3@test.com` → 75 días inactivo
- `test_fid_cliente4@test.com` → 90 días inactivo

### Servicios creados

- `Test Reacomodamiento` → Permite reacomodamiento ✓
- `Test Corte (30 días)` → Frecuencia: 30 días
- `Test Coloración (60 días)` → Frecuencia: 60 días
- `Test Tratamiento (Global)` → Usa config global

---

## ⚠️ Notas Importantes

1. **Prerequisitos:** Ejecuta `python Scripts/poblar_usuarios_base.py` primero para tener empleados
2. **Limpieza:** Usa `limpiar_tests_diagnostico.py` entre pruebas para evitar duplicados
3. **Emails:** Los emails de testing son ficticios (`@test.com`)
4. **Seguridad:** Los scripts solo afectan datos con prefijo `test_opt_` y `test_fid_`
5. **Fechas:** Los scripts usan fechas relativas (días desde hoy)

---

## 🐛 Solución de Problemas

### Error: "No hay empleados en el sistema"

```bash
python Scripts/poblar_usuarios_base.py
```

### Error: "Turno ya existe"

```bash
python Scripts/limpiar_tests_diagnostico.py
# Luego volver a ejecutar el script de testing
```

### Los clientes no aparecen en fidelización

- Verificar que `frecuencia_recurrencia_dias` del servicio esté configurado
- Verificar `margen_fidelizacion_dias` en ConfiguracionGlobal
- Asegurarse que los turnos tengan estado "completado"

### El proceso 2 no encuentra candidatos

- Verificar que `permite_reacomodamiento=True` en el servicio
- Asegurarse que el turno candidato sea POSTERIOR al cancelado
- Verificar que ambos turnos usen el MISMO servicio

---

## 📚 Referencias

- **Backend:** `apps/turnos/views_diagnostico.py`
- **Frontend:** `dashboard/propietario/diagnostico/page.tsx`
- **Documentación:** Ver README.md principal del proyecto
