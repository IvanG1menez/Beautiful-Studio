# UserHeader Component - Beautiful Studio

## 📋 Descripción

Componente de navegación reutilizable y adaptable para el sistema Beautiful Studio. Se adapta automáticamente según el rol del usuario autenticado.

## ✨ Características

- ✅ **Autenticación integrada** - Usa el contexto `useAuth`
- ✅ **Adaptable por roles** - Muestra diferentes enlaces según el rol del usuario
- ✅ **Responsive** - Menú móvil completo con hamburguesa
- ✅ **Avatar con iniciales** - Genera iniciales automáticamente desde el nombre
- ✅ **Menú desplegable** - Dropdown con opciones de perfil y cierre de sesión
- ✅ **Badges de rol** - Colores diferentes según el tipo de usuario
- ✅ **Navegación contextual** - Enlaces específicos para cada rol

## 🎨 Roles Soportados

| Rol                      | Color Badge | Enlaces de Navegación                    |
| ------------------------ | ----------- | ---------------------------------------- |
| **Admin/Propietario**    | 🟣 Púrpura  | Dashboard, Turnos, Empleados, Clientes   |
| **Empleado/Profesional** | 🔵 Azul     | Mi Dashboard, Mis Turnos, Mi Horario     |
| **Cliente**              | 🟢 Verde    | Mi Dashboard, Reservar Turno, Mis Turnos |

## 📦 Instalación

### Componentes de shadcn/ui requeridos:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
```

## 🚀 Uso Básico

### 1. En tu layout principal:

```tsx
// app/layout.tsx
import UserHeader from "@/components/UserHeader";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <UserHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

### 2. En páginas específicas:

```tsx
// app/dashboard/page.tsx
import UserHeader from "@/components/UserHeader";

export default function DashboardPage() {
  return (
    <>
      <UserHeader />
      <div className="container mx-auto p-6">
        {/* Contenido del dashboard */}
      </div>
    </>
  );
}
```

### 3. Con clase personalizada:

```tsx
<UserHeader className="sticky top-0 z-50" />
```

## 🔧 Configuración

### Estructura del objeto User requerida:

```typescript
interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role:
    | "admin"
    | "empleado"
    | "cliente"
    | "profesional"
    | "propietario"
    | "superusuario";
  is_active: boolean;
}
```

### Hook useAuth requerido:

```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}
```

## 🎯 Funcionalidades

### Avatar

- **Iniciales automáticas**: Toma las iniciales del nombre y apellido
- **Fallback al username**: Si no hay nombre, usa el username
- **Gradiente personalizado**: Rosa a púrpura para el fondo
- **Hover effect**: Anillo púrpura al pasar el mouse

### Menú Desplegable

Opciones disponibles:

1. **Mi Perfil** - Redirige al dashboard específico del rol
2. **Configuración** - Redirige a `/configuracion`
3. **Cerrar Sesión** - Ejecuta `logout()` y redirige a `/login`

### Navegación por Rol

#### Admin/Propietario/Superusuario:

```tsx
- Dashboard → /dashboard-admin
- Turnos → /admin/turnos
- Empleados → /admin/empleados
- Clientes → /admin/clientes
```

#### Empleado/Profesional:

```tsx
- Mi Dashboard → /dashboard-empleado
- Mis Turnos → /empleado/turnos
- Mi Horario → /empleado/horario
```

#### Cliente:

```tsx
- Mi Dashboard → /dashboard-cliente
- Reservar Turno → /reservar-turno
- Mis Turnos → /mis-turnos
```

## 📱 Responsive Design

### Desktop (≥768px):

- Navegación horizontal con enlaces visibles
- Avatar + nombre + rol en la derecha
- Dropdown menu completo

### Mobile (<768px):

- Botón hamburguesa
- Menú desplegable vertical
- Avatar + info del usuario en el menú
- Navegación colapsable

## 🎨 Personalización

### Cambiar colores del gradiente:

```tsx
// En UserHeader.tsx, buscar:
from-pink-500 to-purple-600

// Reemplazar por:
from-blue-500 to-indigo-600
```

### Agregar más enlaces de navegación:

```tsx
// Modificar la función getNavigationLinks()
if (role === "admin") {
  return [
    // ... enlaces existentes
    { label: "Reportes", href: "/admin/reportes", icon: BarChart },
  ];
}
```

### Personalizar badges de rol:

```tsx
// Modificar getRoleBadgeColor()
case 'admin':
  return 'bg-red-100 text-red-800'; // Nuevo color
```

## 🔒 Protección de Rutas

El componente solo muestra opciones si el usuario está autenticado:

```tsx
{isAuthenticated && user ? (
  // Mostrar opciones de usuario
) : (
  // Mostrar botones de login/registro
)}
```

## 🐛 Solución de Problemas

### El usuario no aparece:

- Verificar que `useAuth` devuelva `user` e `isAuthenticated` correctamente
- Verificar que localStorage tenga el token guardado

### Los enlaces no funcionan:

- Asegurarse de que las rutas existan en tu aplicación
- Verificar que Next.js esté en modo App Router

### El menú móvil no se cierra:

- El estado `mobileMenuOpen` debe estar funcionando
- Verificar que `setMobileMenuOpen(false)` se ejecute en los clicks

## 📄 Licencia

Este componente es parte del proyecto Beautiful Studio.

---

**Creado con ❤️ para Beautiful Studio**
