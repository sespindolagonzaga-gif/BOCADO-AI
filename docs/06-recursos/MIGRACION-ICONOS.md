# Migración de Iconos a Lucide React

## Resumen
Se migraron 21 iconos personalizados a `lucide-react`, manteniendo solo los iconos específicos de Bocado que no existen en la librería.

## Iconos Migrados

| Icono Personalizado | Icono Lucide | Archivos Afectados |
|---------------------|--------------|-------------------|
| UserIcon | User | BottomTabBar, TutorialModal, ProfileScreen |
| HomeIcon | Home | BottomTabBar, TutorialModal, NotificationSettings |
| HeartIcon | Heart | MealCard |
| StarIcon | Star | NotificationSettings |
| BellIcon | Bell | NotificationSettings, ProfileScreen |
| BellSlashIcon | BellOff | NotificationSettings |
| TrashIcon | Trash2 | ProfileScreen, PermissionsScreen |
| LockIcon | Lock | Step1, ProfileScreen, PermissionsScreen |
| ClockIcon | Clock | NotificationSettings |
| BookIcon | BookOpen | BottomTabBar, TutorialModal, SavedRecipesScreen |
| LocationIcon | MapPin | TutorialModal, RecommendationScreen, SavedRestaurantsScreen, Step1 |
| DownloadIcon | Download | ProfileScreen |
| ExclamationIcon | AlertTriangle | ProfileScreen |
| DocumentTextIcon | FileText | ProfileScreen |
| ChevronDownIcon | ChevronDown | MealCard |
| ShieldCheckIcon | ShieldCheck | PermissionsScreen |
| EyeIcon | Eye | PermissionsScreen |
| RestaurantIcon | UtensilsCrossed | BottomTabBar, TutorialModal, PantryZoneSelector |
| ScaleIcon | Scale | Step1 |
| RulerIcon | Ruler | Step1 |
| CheckCircleIcon | CheckCircle | Eliminado (no se usaba) |

## Iconos Mantenidos (Específicos de Bocado)

Estos iconos no existen en `lucide-react` y se mantienen:

- `MaleIcon` - Icono de género masculino
- `FemaleIcon` - Icono de género femenino
- `OtherGenderIcon` - Icono de otro género
- `MeatIcon` - Categoría de carne
- `FishIcon` - Categoría de pescado
- `DairyIcon` - Categoría de lácteos
- `VegetableIcon` - Categoría de vegetales
- `FruitIcon` - Categoría de frutas
- `GrainsIcon` - Categoría de granos
- `NutsIcon` - Categoría de frutos secos
- `SpicesIcon` - Categoría de especias

## Estructura del Barrel Export

```typescript
// src/components/icons/index.ts

// Iconos de Lucide React (tree-shakeable)
export {
  User, Home, Heart, Star, Bell, BellOff, Trash2, Lock, Clock,
  BookOpen, MapPin, Download, AlertTriangle, FileText, ChevronDown,
  ShieldCheck, Eye, UtensilsCrossed, Scale, Ruler, ChefHat, CheckCircle,
} from 'lucide-react';

// Iconos personalizados específicos de Bocado
export { MaleIcon } from './MaleIcon';
export { FemaleIcon } from './FemaleIcon';
// ... etc
```

## Beneficios

1. **Bundle size reducido**: Los iconos de lucide-react están optimizados para tree-shaking
2. **Mantenibilidad**: Un solo source of truth para iconos estándar
3. **Consistencia**: Todos los iconos tienen el mismo estilo visual
4. **Updates automáticos**: Lucide-react recibe actualizaciones regulares

## Uso

```typescript
// Antes
import { UserIcon } from './icons/UserIcon';
import { LockIcon } from './icons/LockIcon';

// Después
import { User, Lock } from './icons';
```

## Notas de Implementación

- El componente `HeartIcon` tenía una prop `filled` personalizada que se migró a usar la prop estándar `fill` de lucide-react
- El `BocadoLogo` sigue siendo un componente separado fuera del directorio `icons/`
- Todos los tests pasan después de la migración
- El build de producción genera los chunks correctamente
