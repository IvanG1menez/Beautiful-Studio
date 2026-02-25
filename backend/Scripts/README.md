# Scripts de Gestión de Base de Datos

## Scripts Disponibles

### 1. `vaciar_bd.py` - Vaciar Base de Datos Completa

Elimina **TODOS** los registros de la base de datos, excepto los usuarios base protegidos.

**Uso:**

```bash
python Scripts/vaciar_bd.py --force
```

**⚠️ Advertencia:** Esta acción es irreversible. Se eliminarán:

- Todos los turnos
- Todos los clientes (excepto el cliente de prueba)
- Todos los empleados (excepto el empleado de prueba)
- Todos los servicios (menos el predeterminado)
- Todo el historial

**Usuarios protegidos que NO se borran:**

- propietario@beautifulstudio.com
- empleado1@beautifulstudio.com
- cliente1@beautifulstudio.com

---

### 2. `poblar_usuarios_base.py` - Crear/Actualizar Usuarios Base

Crea o actualiza los 3 usuarios base del sistema con sus perfiles y configuraciones.

**Uso:**

```bash
python Scripts/poblar_usuarios_base.py
```

**Crea/Actualiza:**

- ✅ Usuario propietario
- ✅ Usuario profesional (empleado1)
- ✅ Usuario cliente (cliente1)
- ✅ Sala predeterminada
- ✅ Categoría "Corte y Peinado"
- ✅ Servicio "Corte de Cabello" ($5000, seña 25%)
- ✅ Billetera del cliente con $1000 de saldo
- ✅ Configuración Global con valores por defecto

**Configuración Global incluida:**
- Horas mínimas para crédito: 24h
- Días de inactividad para reincorporación: 60 días
- Descuento de fidelización: 15%
- Capacidad máxima global: 0 (sin límite)

**Credenciales creadas:**

```
Propietario:
- Email: propietario@beautifulstudio.com
- Contraseña: propietario123

Profesional:
- Email: empleado1@beautifulstudio.com
- Contraseña: empleado123

Cliente:
- Email: cliente1@beautifulstudio.com
- Contraseña: cliente123
```

---

### 3. `limpiar_turnos.py` - Limpiar Solo Turnos

Elimina únicamente los turnos y restablece las billeteras a $1000.

**Uso:**

```bash
python Scripts/limpiar_turnos.py
```

**Ideal para:**

- Probar el flujo de reserva repetidamente
- Evitar conflictos de horarios duplicados
- Restablecer billeteras a su saldo inicial

---

## Flujo de Trabajo Recomendado

### Para empezar desde cero:

```bash
# 1. Vaciar toda la base de datos
python Scripts/vaciar_bd.py --force

# 2. Crear usuarios base
python Scripts/poblar_usuarios_base.py
```

### Para probar el flujo de reservas:

```bash
# Limpiar solo los turnos (mantiene todo lo demás)
python Scripts/limpiar_turnos.py
```

### Para restablecer y probar de nuevo:

```bash
# Limpiar turnos y restablecer billeteras
python Scripts/limpiar_turnos.py

# Ahora puedes:
# - Crear turnos sin conflictos
# - El cliente tiene $1000 en su billetera
# - Probar el descuento de seña con saldo
```

---

## Notas Importantes

1. **Siempre ejecuta estos scripts desde el directorio `backend/`**
2. **El saldo de la billetera se restablece a $1000** cada vez que ejecutas `poblar_usuarios_base.py` o `limpiar_turnos.py`
3. **Los turnos duplicados causan error**: Si ves "Los campos empleado, fecha_hora deben formar un conjunto único", ejecuta `limpiar_turnos.py`
4. **El servicio tiene 25% de seña**: Al reservar un turno de $5000, se debe pagar $1250 de seña (descontable con billetera)

---

## Solución de Problemas

### Error: "Los campos empleado, fecha_hora deben formar un conjunto único"

**Causa:** Ya existe un turno para ese empleado en esa fecha/hora.  
**Solución:**

```bash
python Scripts/limpiar_turnos.py
```

### La billetera no tiene $1000

**Solución:**

```bash
python Scripts/poblar_usuarios_base.py
```

### Los usuarios no existen

**Solución:**

```bash
python Scripts/vaciar_bd.py --force
python Scripts/poblar_usuarios_base.py
```

---

### 4. `inicializar_config_global.py` - Inicializar Configuración Global

Crea el registro singleton de ConfiguracionGlobal con valores por defecto.

**Uso:**

```bash
python Scripts/inicializar_config_global.py
```

**Configura:**

- ✅ Horas mínimas para crédito por cancelación: 24h
- ✅ Días de inactividad para reincorporación: 60 días
- ✅ Porcentaje de descuento fidelización: 15%
- ✅ Capacidad máxima global del local: 0 (sin límite)

**Dónde modificar:**

- Frontend: Dashboard Propietario > Configuración > Pestaña General
- Admin Django: `/admin/authentication/configuracionglobal/`

**¿Cómo funciona?**

- **Billetera Virtual**: Si un cliente cancela con al menos 24h de antelación, recibe crédito automático
- **Oportunidades de Agenda**: Identifica clientes inactivos hace 60+ días
- **Descuento Automático**: Al enviar invitación de reincorporación, aplica 15% de descuento
- **Capacidad Global**: Límite total de turnos simultáneos (0 = solo usa capacidad de salas)
