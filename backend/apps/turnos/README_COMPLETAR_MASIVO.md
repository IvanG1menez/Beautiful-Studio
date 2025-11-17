# ✅ Completar Turnos Masivamente

## 📋 Descripción

Esta funcionalidad permite a los profesionales marcar múltiples turnos como completados de manera eficiente, evitando tener que completar cada turno uno por uno.

---

## 🎯 Características

### 1. **Filtrar por Rango de Fechas**

- Seleccionar fecha desde y fecha hasta
- Ver todos los turnos pendientes/confirmados en ese rango
- Vista en tabla con información completa de cada turno

### 2. **Selección Flexible**

- ✅ Seleccionar todos los turnos del rango
- ✅ Seleccionar turnos individuales con checkbox
- ✅ Contador visual de turnos seleccionados

### 3. **Completar Turnos - Múltiples Opciones**

#### Opción A: Completar Seleccionados

Marca como completados solo los turnos que hayas marcado con checkbox.

#### Opción B: Completar Todos del Rango

Marca como completados todos los turnos del rango de fechas (sin importar la selección).

#### Opción C: Completar Última Semana

Atajo rápido que completa todos los turnos de los últimos 7 días.

---

## 🚀 Uso en el Dashboard

### Paso 1: Acceder a la Funcionalidad

1. Iniciar sesión como **profesional**
2. En el menú lateral, hacer clic en **"Completar Turnos"**

### Paso 2: Filtrar Turnos

1. Seleccionar **Fecha Desde** (ejemplo: 01/11/2025)
2. Seleccionar **Fecha Hasta** (ejemplo: 15/11/2025)
3. Hacer clic en **"Buscar Turnos"**

### Paso 3: Revisar los Turnos

La tabla mostrará:

- ☑️ Checkbox para seleccionar
- 👤 **Cliente**: Nombre del cliente
- 💇 **Servicio**: Tipo de servicio
- 📅 **Fecha/Hora**: Cuándo es el turno
- 🏷️ **Estado**: Pendiente/Confirmado/En Proceso
- 💰 **Precio**: Precio del servicio

### Paso 4: Seleccionar Turnos

**Opción 1 - Seleccionar Todos:**

- Hacer clic en el checkbox del encabezado de la tabla

**Opción 2 - Seleccionar Individualmente:**

- Marcar los turnos que quieras completar

### Paso 5: Completar Turnos

**Botón "Completar Seleccionados" (azul):**

- Completa solo los turnos marcados con checkbox
- Ideal para revisar uno por uno

**Botón "Completar Todos del Rango" (verde):**

- Completa TODOS los turnos del rango de fechas
- Más rápido cuando confías en el filtro

**Botón "Completar Última Semana" (morado):**

- Ignora el filtro de fechas
- Completa automáticamente todos los turnos de los últimos 7 días

### Paso 6: Confirmar

Aparecerá una notificación indicando:

- ✅ Cuántos turnos se completaron exitosamente
- ⚠️ Si alguno falló (con el motivo)

---

## 🔒 Seguridad

- Solo los **profesionales** pueden acceder
- Cada profesional solo ve **sus propios turnos**
- No se pueden completar turnos:
  - Ya completados
  - Cancelados
  - De clientes que no asistieron

---

## 📊 Estados de Turno

| Estado        | ¿Se puede completar? | Descripción       |
| ------------- | -------------------- | ----------------- |
| 🟡 Pendiente  | ✅ Sí                | Turno reservado   |
| 🟢 Confirmado | ✅ Sí                | Cliente confirmó  |
| 🔵 En Proceso | ✅ Sí                | Atención en curso |
| ⚫ Completado | ❌ No                | Ya finalizado     |
| 🔴 Cancelado  | ❌ No                | Turno cancelado   |
| ⚪ No Asistió | ❌ No                | Cliente faltó     |

---

## 💡 Consejos de Uso

### Para fin de día:

```
1. Seleccionar fecha de HOY
2. Clic en "Buscar Turnos"
3. Revisar la lista
4. Clic en "Completar Todos del Rango"
```

### Para fin de semana:

```
1. Clic directo en "Completar Última Semana"
2. Confirmar en el diálogo
3. ¡Listo!
```

### Para revisar uno por uno:

```
1. Filtrar por fechas
2. Marcar los que SÍ se hicieron
3. Clic en "Completar Seleccionados"
```

---

## 🧪 Testing

### Backend

Ejecutar el script de pruebas:

```bash
cd backend
python Scripts/test_completar_turnos_masivo.py
```

**Antes de ejecutar:**

1. Obtener token de profesional desde `/admin/authtoken/tokenproxy/`
2. Actualizar variable `TOKEN` en el script

### Frontend

1. Iniciar servidor: `npm run dev` (desde `frontend/`)
2. Navegar a: `http://localhost:3000/dashboard-profesional/completar-turnos`
3. Probar cada botón y verificar notificaciones

---

## 📚 Documentación API

Ver detalles técnicos completos en:

- [API_COMPLETAR_MASIVO.md](./API_COMPLETAR_MASIVO.md)

---

## 🐛 Solución de Problemas

### Error: "Solo los profesionales pueden marcar turnos como completados"

**Solución:** Verificar que el usuario tiene perfil de profesional activo.

### Error: "Debe proporcionar turno_ids o un rango de fechas"

**Solución:** Asegurarse de enviar al menos uno de los dos parámetros.

### No aparecen turnos en el rango

**Solución:**

- Verificar que existen turnos en ese rango
- Verificar que los turnos pertenecen al profesional logueado
- Verificar que los turnos están en estado pendiente/confirmado

### Algunos turnos no se completan

**Solución:** Ver el mensaje de error específico. Posibles causas:

- El turno ya está completado
- El turno fue cancelado
- El turno no pertenece al profesional

---

## 📝 Notas Importantes

1. **No es reversible:** Una vez completado un turno, no se puede revertir automáticamente.
2. **Auditoría:** Todos los cambios quedan registrados en el historial.
3. **Notificaciones:** Se podrían agregar emails automáticos al completar turnos (opcional).
4. **Performance:** Funciona bien hasta 100+ turnos. Para volúmenes mayores, considerar procesamiento en background.

---

## 🎨 Capturas de Pantalla

### Vista Principal

```
┌─────────────────────────────────────────────────────────┐
│ Completar Turnos Masivamente                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Fecha Desde: __/__/____]  [Fecha Hasta: __/__/____]   │
│                                           [Buscar]       │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ ☑ Cliente    Servicio    Fecha       Estado   $  │  │
│ ├───────────────────────────────────────────────────┤  │
│ │ ☐ Juan P.    Corte       10/11 14:00  Conf.  500 │  │
│ │ ☐ María G.   Manicure    10/11 15:00  Pend.  300 │  │
│ │ ☐ Carlos R.  Barba       10/11 16:00  Conf.  200 │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ Turnos seleccionados: 0 de 3                            │
│                                                          │
│ [Completar Seleccionados] [Completar Todos del Rango]  │
│ [Completar Última Semana]                               │
└─────────────────────────────────────────────────────────┘
```

---

## 👨‍💻 Desarrollo

### Archivos Principales

**Backend:**

- `apps/turnos/views.py` - Lógica de endpoints
- `apps/turnos/serializers.py` - Validación de datos
- `Scripts/test_completar_turnos_masivo.py` - Tests

**Frontend:**

- `components/turnos/CompletarTurnosMasivo.tsx` - Componente principal
- `app/dashboard-profesional/completar-turnos/page.tsx` - Página
- `app/dashboard-profesional/layout.tsx` - Menú

### Endpoints API

1. `GET /api/turnos/pendientes-rango/` - Buscar turnos
2. `POST /api/turnos/completar-masivo/` - Completar por IDs o rango
3. `POST /api/turnos/completar-ultima-semana/` - Completar última semana

---

## 🔄 Próximas Mejoras (Opcional)

- [ ] Enviar email de confirmación al completar turnos
- [ ] Agregar filtro por servicio
- [ ] Agregar filtro por cliente
- [ ] Exportar reporte de turnos completados
- [ ] Procesamiento en background para grandes volúmenes
- [ ] Estadísticas de turnos completados por período

---

## ✅ Checklist de Implementación

- [x] Backend - 3 endpoints implementados
- [x] Frontend - Componente React creado
- [x] Integración - Página agregada al dashboard profesional
- [x] Menú - Opción "Completar Turnos" visible
- [x] Documentación - README y API docs
- [x] Testing - Script de pruebas Python
- [ ] Testing Manual - Probar en navegador
- [ ] Testing E2E - Verificar flujo completo

---

**¿Necesitas ayuda?** Consulta la documentación técnica completa en [API_COMPLETAR_MASIVO.md](./API_COMPLETAR_MASIVO.md)
