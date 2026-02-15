# Sistema de Componentes UI - Bocado AI

Este documento describe los componentes base reutilizables disponibles en la aplicación Bocado AI.

## 📁 Importación

Todos los componentes se pueden importar desde el barrel export:

```typescript
import { Button, Card, Input, Badge } from '@/components/ui';
```

O individualmente:

```typescript
import { Button } from '@/components/ui/Button';
```

---

## 🔘 Button

Botón interactivo con múltiples variantes y estados.

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'danger'` | `'primary'` | Estilo visual del botón |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Tamaño del botón |
| `isLoading` | `boolean` | `false` | Muestra spinner de carga |
| `fullWidth` | `boolean` | `false` | Ocupa todo el ancho disponible |

### Ejemplos

```tsx
{/* Botón primario básico */}
<Button>Guardar cambios</Button>

{/* Variantes */}
<Button variant="secondary">Cancelar</Button>
<Button variant="outline">Ver detalles</Button>
<Button variant="ghost">Cerrar</Button>
<Button variant="danger">Eliminar</Button>

{/* Tamaños */}
<Button size="sm">Pequeño</Button>
<Button size="md">Mediano</Button>
<Button size="lg">Grande</Button>

{/* Estados */}
<Button isLoading>Procesando...</Button>
<Button disabled>No disponible</Button>
<Button fullWidth>Ocupar todo el ancho</Button>

{/* Con icono */}
<Button>
  <PlusIcon className="w-4 h-4 mr-2" />
  Agregar item
</Button>
```

---

## 🃏 Card

Contenedor visual para agrupar contenido relacionado.

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Espaciado interno |
| `shadow` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Sombra del card |
| `className` | `string` | - | Clases adicionales |

### Subcomponentes

- `CardHeader` - Encabezado del card
- `CardTitle` - Título principal
- `CardDescription` - Descripción secundaria
- `CardContent` - Contenido principal
- `CardFooter` - Pie del card

### Ejemplos

```tsx
{/* Card simple */}
<Card>
  <p>Contenido del card</p>
</Card>

{/* Card estructurado */}
<Card padding="lg" shadow="lg">
  <CardHeader>
    <CardTitle>Título del Card</CardTitle>
    <CardDescription>
      Descripción opcional del contenido
    </CardDescription>
  </CardHeader>
  <CardContent>
    <p>Contenido principal aquí...</p>
  </CardContent>
  <CardFooter>
    <Button variant="outline">Cancelar</Button>
    <Button>Aceptar</Button>
  </CardFooter>
</Card>

{/* Card sin padding para imágenes */}
<Card padding="none">
  <img src="/imagen.jpg" alt="..." />
  <div className="p-4">
    <h3>Título</h3>
  </div>
</Card>
```

---

## 📝 Input

Campo de texto con soporte para labels, errores e iconos.

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `label` | `string` | - | Etiqueta del campo |
| `error` | `string` | - | Mensaje de error |
| `helperText` | `string` | - | Texto de ayuda |
| `leftIcon` | `ReactNode` | - | Icono a la izquierda |
| `rightIcon` | `ReactNode` | - | Icono a la derecha |

### Ejemplos

```tsx
{/* Input básico */}
<Input placeholder="Ingresa tu nombre" />

{/* Con label y helper */}
<Input
  label="Correo electrónico"
  placeholder="ejemplo@correo.com"
  helperText="Te enviaremos un código de verificación"
/>

{/* Con error */}
<Input
  label="Contraseña"
  type="password"
  error="La contraseña debe tener al menos 8 caracteres"
/>

{/* Con iconos */}
<Input
  label="Buscar"
  placeholder="Buscar recetas..."
  leftIcon={<SearchIcon className="w-5 h-5" />}
/>

<Input
  label="Precio"
  placeholder="0.00"
  rightIcon={<span className="text-bocado-gray">€</span>}
/>

{/* Deshabilitado */}
<Input
  label="Campo bloqueado"
  value="Valor fijo"
  disabled
/>
```

### TextArea

Variante para texto multilínea:

```tsx
import { TextArea } from '@/components/ui';

<TextArea
  label="Descripción"
  placeholder="Describe tu receta..."
  rows={4}
  helperText="Máximo 500 caracteres"
/>
```

---

## 🏷️ Badge

Etiqueta visual para estados, categorías o contadores.

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `variant` | `'default' \| 'success' \| 'warning' \| 'error' \| 'info'` | `'default'` | Color del badge |
| `size` | `'sm' \| 'md'` | `'sm'` | Tamaño del badge |

### Variantes

| Variante | Uso típico |
|----------|------------|
| `default` | Etiquetas generales |
| `success` | Completado, activo, disponible |
| `warning` | Pendiente, advertencia |
| `error` | Error, rechazado, vencido |
| `info` | Información, en progreso |

### Ejemplos

```tsx
{/* Badges básicos */}
<Badge>Nuevo</Badge>
<Badge variant="success">Completado</Badge>
<Badge variant="warning">Pendiente</Badge>
<Badge variant="error">Cancelado</Badge>
<Badge variant="info">En progreso</Badge>

{/* Tamaños */}
<Badge size="sm">Pequeño</Badge>
<Badge size="md">Mediano</Badge>

{/* Con icono */}
import { BadgeWithIcon } from '@/components/ui';

<BadgeWithIcon 
  variant="success" 
  icon={<CheckIcon className="w-3 h-3" />}
>
  Verificado
</BadgeWithIcon>

{/* Badge con punto de estado */}
import { DotBadge } from '@/components/ui';

<DotBadge text="En línea" variant="success" />
<DotBadge text="Desconectado" variant="default" />
```

---

## 🎨 Utilidades CSS

Las siguientes clases utilitarias están disponibles en `src/styles/utilities.css`:

### Safe Areas (iOS/Android)

```css
.pt-safe      /* padding-top con safe-area */
.pb-safe      /* padding-bottom con safe-area */
.px-safe      /* padding horizontal con safe-area */
.p-safe       /* padding completo con safe-area */
.mb-safe      /* margin-bottom con safe-area */
```

### Scrollbar

```css
.no-scrollbar        /* Oculta scrollbar */
.scrollbar-bocado    /* Estilo Bocado para scrollbar */
```

### Focus Rings

```css
.focus-ring           /* Ring estándar verde */
.focus-ring-inverse   /* Ring para fondos oscuros */
.focus-ring-keyboard  /* Solo visible con teclado */
```

### Texto

```css
.line-clamp-1    /* Una línea con ellipsis */
.line-clamp-2    /* Dos líneas con ellipsis */
.line-clamp-3    /* Tres líneas con ellipsis */
```

### Interacción

```css
.select-none           /* Prevenir selección */
.touch-manipulation    /* Optimizar touch */
.pointer-events-none   /* Deshabilitar clicks */
```

### Layout

```css
.app-container    /* max-w-mobile + centered */
.divider          /* Línea separadora */
.sticky-bottom    /* Fixed bottom + safe area */
```

---

## 🎭 Animaciones

Las siguientes animaciones están configuradas en Tailwind:

| Clase | Descripción |
|-------|-------------|
| `animate-fade-in` | Aparece con fade (0.3s) |
| `animate-slide-up` | Entra desde abajo (0.3s) |
| `animate-skeleton-pulse` | Pulsación para skeletons |
| `animate-skeleton-shimmer` | Efecto shimmer para skeletons |

### Ejemplos

```tsx
{/* Fade in al montar */}
<div className="animate-fade-in">
  Contenido que aparece suavemente
</div>

{/* Slide up */}
<div className="animate-slide-up">
  Contenido que sube desde abajo
</div>
```

---

## ♿ Accesibilidad

Todos los componentes incluyen:

- **ARIA labels** automáticos donde es necesario
- ** Estados disabled** correctamente señalados
- **Focus rings** visibles para navegación por teclado
- **Mensajes de error** asociados con `aria-describedby`
- **Contraste de color** que cumple WCAG AA

### Buenas prácticas

```tsx
{/* Siempre usar label para inputs */}
<Input label="Nombre completo" />

{/* Proporcionar textos alternativos en iconos */}
<Button>
  <SearchIcon aria-hidden="true" />
  <span className="sr-only">Buscar</span>
</Button>

{/* Indicar estado de carga */}
<Button isLoading aria-label="Guardando cambios">
  Guardar
</Button>
```

---

## 🎯 Patrones Comunes

### Formulario completo

```tsx
<Card padding="lg">
  <CardHeader>
    <CardTitle>Crear cuenta</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Input
      label="Nombre"
      placeholder="Tu nombre"
      leftIcon={<UserIcon className="w-5 h-5" />}
    />
    <Input
      label="Email"
      type="email"
      placeholder="correo@ejemplo.com"
    />
    <Input
      label="Contraseña"
      type="password"
      error="Mínimo 8 caracteres"
    />
  </CardContent>
  <CardFooter>
    <Button fullWidth>Crear cuenta</Button>
  </CardFooter>
</Card>
```

### Lista con estados

```tsx
<Card>
  <div className="flex items-center justify-between p-4">
    <div>
      <h4 className="font-medium">Receta guardada</h4>
      <p className="text-sm text-bocado-dark-gray">Hace 2 días</p>
    </div>
    <Badge variant="success">Activa</Badge>
  </div>
</Card>
```

---

## 📝 Notas de Implementación

1. **Colores**: Los componentes usan la paleta `bocado` definida en `tailwind.config.js`
2. **Tipografía**: Usa el sistema tipográfico definido (2xs, xs, sm, base, lg, xl)
3. **Espaciado**: Sigue la escala de Tailwind con valores adicionales (18, 88)
4. **Bordes redondeados**: Predominantemente `rounded-xl` (12px) y `rounded-2xl` (16px)
5. **Sombras**: Usa `shadow-bocado` y `shadow-bocado-lg` para consistencia
