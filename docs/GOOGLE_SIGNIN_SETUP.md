# Configuración de Google Sign-In en Firebase

## Pasos para habilitar Google Sign-In

### 1. En Firebase Console

1. Ve a tu proyecto en [Firebase Console](https://console.firebase.google.com/)
2. En el menú lateral, ve a **Authentication** > **Sign-in method**
3. En la pestaña **Sign-in providers**, busca **Google**
4. Haz clic en **Google** y luego en **Enable** (Habilitar)
5. Configura:
   - **Project support email**: Selecciona tu email
   - **Project public-facing name**: El nombre público de tu app (ej: "Bocado AI")
6. Haz clic en **Save** (Guardar)

### 2. Configuración OAuth (Opcional pero Recomendado)

Para producción, es recomendable configurar tu propio cliente OAuth:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto de Firebase
3. Ve a **APIs & Services** > **Credentials**
4. Crea credenciales OAuth 2.0:
   - **Application type**: Web application
   - **Authorized JavaScript origins**: Agrega tu dominio (ej: https://bocado-ai.vercel.app)
   - **Authorized redirect URIs**: Copia las URIs que Firebase te proporciona

### 3. Verificación

Una vez habilitado:

1. Inicia tu app: `npm run dev`
2. Ve a la pantalla de registro o login
3. Deberías ver el botón **"Continuar con Google"**
4. Haz clic y prueba el flujo completo

## Características Implementadas

### Login Screen
- ✅ Botón "Continuar con Google" en pantalla de login
- ✅ Separador visual entre Google y Email/Password
- ✅ Si el usuario no está registrado, muestra error y sugiere registro
- ✅ Analytics tracking para eventos de Google Sign-In

### Registration Flow
- ✅ Pantalla inicial para elegir método de registro (Google o Email)
- ✅ Si elige Google y es nuevo usuario, crea perfil básico
- ✅ Si elige Google y ya existe, muestra error y sugiere login
- ✅ Flujo completo de registro con Google incluye completar perfil

### Seguridad
- ✅ Verificación de usuarios existentes vs nuevos
- ✅ Manejo de errores (popup cerrado, red, etc.)
- ✅ Analytics para debugging y métricas
- ✅ No se rompe funcionalidad existente de Email/Password

## Eventos de Analytics Trackeados

- `login_google_success`: Login exitoso con Google
- `login_google_error`: Error al intentar login con Google
- `login_google_missing_profile`: Usuario de Google sin perfil en Firestore
- `registration_google_initiated`: Inicio de registro con Google
- `registration_google_error`: Error en registro con Google
- `registration_method_email_selected`: Usuario eligió Email en vez de Google

## Archivos Modificados

- `src/services/authService.ts`: Nueva función `signInWithGoogle()`
- `src/components/LoginScreen.tsx`: Botón y lógica de Google Sign-In
- `src/components/RegistrationMethodScreen.tsx`: Nueva pantalla de selección
- `src/App.tsx`: Integración de nueva pantalla en el flujo
- `src/locales/es.json` y `en.json`: Traducciones

## Notas Importantes

- ✅ **No se rompe nada existente**: Email/Password sigue funcionando igual
- ✅ **Ambas opciones disponibles**: Los usuarios pueden elegir su método preferido
- ✅ **Perfil completo requerido**: Usuarios de Google deben completar su perfil igual que con Email
- ✅ **Verificación automática**: Cuentas de Google ya vienen verificadas

## Testing

Para probar en desarrollo:
```bash
npm run dev
```

Para probar la build:
```bash
npm run build
npm run preview
```
