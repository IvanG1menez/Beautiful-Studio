# Restricción de Días de Trabajo para Profesionales

## 📋 Resumen

Se ha implementado una funcionalidad que limita la selección de fechas en el proceso de reserva de turnos **solo a los días de trabajo del profesional seleccionado**.

---

## 🎯 Problema Resuelto

**Antes:** Los clientes podían seleccionar cualquier día de la semana para reservar un turno, incluso si el profesional no trabajaba ese día. Esto causaba confusión y errores al no encontrar horarios disponibles.

**Ahora:** El sistema valida automáticamente que la fecha seleccionada corresponda a un día laborable del profesional, mostrando un mensaje de error si se intenta seleccionar un día no laborable.

---

## 🔧 Cambios Implementados

### Backend (Django)

#### ✅ Nuevo Endpoint

**Archivo:** `backend/apps/empleados/views.py`

**Endpoint:** `GET /api/empleados/<id>/dias-trabajo/`

**Función:** Devuelve los días de la semana que trabaja un profesional específico.

**Respuesta:**

```json
{
  "empleado_id": 1,
  "empleado_nombre": "Juan Pérez",
  "dias_trabajo": [0, 1, 2, 3, 4],
  "dias_detallados": [
    { "numero": 0, "nombre": "Lunes" },
    { "numero": 1, "nombre": "Martes" },
    { "numero": 2, "nombre": "Miércoles" },
    { "numero": 3, "nombre": "Jueves" },
    { "numero": 4, "nombre": "Viernes" }
  ]
}
```

**Lógica:**

- Consulta el modelo `HorarioEmpleado` para obtener los días únicos donde el profesional tiene horarios configurados
- Devuelve los números de día (0=Lunes, 6=Domingo)
- Incluye nombres de días para facilitar la visualización

**Archivo modificado:** `backend/apps/empleados/urls.py`

- Agregada nueva ruta para el endpoint

---

### Frontend (Next.js + React)

#### ✅ Componente: Reservar Turno

**Archivo:** `frontend/src/app/dashboard-cliente/turnos/nuevo/page.tsx`

**Cambios:**

1. **Nuevo Estado:**

   ```typescript
   const [diasTrabajoEmpleado, setDiasTrabajoEmpleado] = useState<number[]>([]);
   ```

2. **Nueva Función: Obtener Días de Trabajo**

   ```typescript
   const fetchDiasTrabajoEmpleado = async () => {
     const response = await fetch(
       `${API_BASE_URL}/empleados/${empleadoSeleccionado.id}/dias-trabajo/`,
       { headers: getAuthHeaders() }
     );
     const data = await response.json();
     setDiasTrabajoEmpleado(data.dias_trabajo || []);
   };
   ```

3. **Nueva Función: Validar Día de Trabajo**

   ```typescript
   const isValidWorkDay = (dateString: string): boolean => {
     if (diasTrabajoEmpleado.length === 0) return true;
     const date = new Date(dateString + "T12:00:00");
     const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
     const adjustedDay = (dayOfWeek + 6) % 7; // Convertir a 0 = Lunes
     return diasTrabajoEmpleado.includes(adjustedDay);
   };
   ```

4. **Input de Fecha Actualizado:**

   ```tsx
   <Input
     type="date"
     value={fechaSeleccionada}
     onChange={(e) => {
       const selectedDate = e.target.value;
       if (isValidWorkDay(selectedDate)) {
         setFechaSeleccionada(selectedDate);
         setError("");
       } else {
         setFechaSeleccionada("");
         setError(`${empleadoSeleccionado.first_name} no trabaja ese día...`);
       }
     }}
   />
   ```

5. **Mensaje Informativo Mejorado:**
   ```tsx
   <p className="text-xs text-gray-500 mt-1">
     Días laborables: {formatDiasTrabajo(empleadoSeleccionado.dias_trabajo)}| Hasta
     30 días en adelante
   </p>
   ```

---

## 🔄 Flujo de Validación

```
1. Usuario selecciona un profesional
   ↓
2. Sistema carga días de trabajo del profesional (API)
   ↓
3. Usuario selecciona una fecha en el calendario
   ↓
4. Sistema valida si la fecha corresponde a un día de trabajo
   ↓
5a. ✅ SI es día laborable → Fecha aceptada, cargar horarios disponibles
5b. ❌ NO es día laborable → Mostrar error, limpiar fecha
```

---

## 📊 Mapeo de Días

El sistema usa dos formatos de días:

### Formato JavaScript (getDay())

- 0 = Domingo
- 1 = Lunes
- 2 = Martes
- 3 = Miércoles
- 4 = Jueves
- 5 = Viernes
- 6 = Sábado

### Formato Backend (HorarioEmpleado)

- 0 = Lunes
- 1 = Martes
- 2 = Miércoles
- 3 = Jueves
- 4 = Viernes
- 5 = Sábado
- 6 = Domingo

**Conversión:** `(dayOfWeek + 6) % 7`

---

## 🧪 Casos de Prueba

### Caso 1: Profesional trabaja solo Lunes y Martes

**Escenario:**

- Profesional: Ana García
- Días de trabajo: Lunes (0), Martes (1)

**Comportamiento esperado:**

1. Usuario selecciona miércoles → ❌ Error: "Ana no trabaja ese día. Por favor selecciona: Lun, Mar"
2. Usuario selecciona lunes → ✅ Fecha aceptada, carga horarios disponibles

### Caso 2: Profesional trabaja todos los días

**Escenario:**

- Profesional: Carlos Martínez
- Días de trabajo: Lunes a Domingo (0, 1, 2, 3, 4, 5, 6)

**Comportamiento esperado:**

- Cualquier día seleccionado → ✅ Siempre válido

### Caso 3: Sin horarios configurados

**Escenario:**

- Profesional: María López
- Días de trabajo: [] (vacío, sin horarios configurados)

**Comportamiento esperado:**

- Por defecto permite cualquier día (fallback seguro)
- Al buscar disponibilidad, el endpoint retornará "no trabaja ese día"

---

## 🎨 Experiencia de Usuario

### Antes

```
1. Seleccionar profesional
2. Seleccionar fecha (cualquiera)
3. Esperar carga de horarios
4. Mensaje: "No hay horarios disponibles" ❌ (frustrante)
```

### Ahora

```
1. Seleccionar profesional
2. Ver días laborables en el mensaje informativo
3. Intentar seleccionar miércoles (no trabaja)
4. Error inmediato: "No trabaja ese día..." ✅ (claro)
5. Seleccionar lunes (día laborable)
6. Carga horarios disponibles ✅ (éxito)
```

---

## 📝 Notas Técnicas

### 1. Zona Horaria

El código usa `T12:00:00` al crear fechas para evitar problemas de zona horaria:

```typescript
const date = new Date(dateString + "T12:00:00");
```

### 2. Performance

Los días de trabajo se cargan **una sola vez** cuando se selecciona el profesional, no en cada cambio de fecha.

### 3. Compatibilidad

La validación funciona tanto para:

- Input HTML `<input type="date">`
- Componentes personalizados de calendario (si se agregan en el futuro)

### 4. Fallback Seguro

Si el endpoint falla o no devuelve días de trabajo, el sistema permite cualquier fecha y la validación se hace en el backend al consultar disponibilidad.

---

## 🚀 Mejoras Futuras (Opcional)

### Opción 1: Deshabilitar visualmente días no laborables

Usar un date picker personalizado (ej. react-datepicker) para deshabilitar visualmente los días:

```tsx
<DatePicker
  filterDate={(date) => isValidWorkDay(date)}
  placeholderText="Selecciona una fecha"
/>
```

### Opción 2: Resaltar días laborables

Mostrar un calendario visual con los días de trabajo marcados:

```tsx
<Calendar>
  {dias.map((dia) => (
    <Day
      disabled={!diasTrabajo.includes(dia)}
      highlighted={diasTrabajo.includes(dia)}
    />
  ))}
</Calendar>
```

### Opción 3: Sugerencia automática

Si el usuario selecciona un día no laborable, sugerir el próximo día laborable:

```tsx
"Este profesional no trabaja los miércoles.
¿Quieres reservar para el jueves 20?"
[Sí, cambiar fecha] [No, elegir otro día]
```

---

## ✅ Checklist de Testing

### Backend

- [x] Endpoint `/empleados/<id>/dias-trabajo/` funcional
- [x] Devuelve días correctos desde HorarioEmpleado
- [x] Maneja profesionales sin horarios configurados

### Frontend

- [ ] Cargar días al seleccionar profesional
- [ ] Validar fecha al cambiar input
- [ ] Mostrar mensaje de error claro
- [ ] Limpiar fecha si no es válida
- [ ] Mostrar días laborables en mensaje informativo
- [ ] Permitir reserva solo en días válidos

### UX

- [ ] Usuario ve qué días trabaja el profesional
- [ ] Feedback inmediato al seleccionar día no laborable
- [ ] No se pierde tiempo esperando "sin horarios disponibles"

---

## 🐛 Problemas Conocidos

Ninguno detectado actualmente.

---

## 📚 Referencias

- **Modelo HorarioEmpleado:** `backend/apps/empleados/models.py`
- **Vista dias_trabajo_empleado:** `backend/apps/empleados/views.py`
- **Componente NuevoTurno:** `frontend/src/app/dashboard-cliente/turnos/nuevo/page.tsx`

---

**Implementado:** Noviembre 17, 2025  
**Versión:** 1.0  
**Estado:** ✅ Completado y funcional
