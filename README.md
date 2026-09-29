# 💜 ARMY FOREVER — Control de Votaciones V1

Proyecto NUEVO e independiente de los otros proyectos ARMY FOREVER.

## Stack
- HTML/CSS/JavaScript
- Supabase Auth
- Supabase Database
- Supabase Storage
- Cloudflare Pages

## 1. Supabase
Crea un proyecto nuevo de Supabase exclusivamente para esta app.

En SQL Editor ejecuta `supabase.sql`.

Después:
1. Authentication > Users > crea tu usuario administrador.
2. Storage > New bucket.
3. Nombre exacto: `vote-receipts`
4. Para esta V1, déjalo como Public.
5. En `app.js`, reemplaza:
   - `https://nryotlwywwlhrbjqqony.supabase.co`
   - `(ya configurada en app.js)`

Usa la **anon/public key**, nunca una service_role key.

## 2. Probar
Puedes abrir `index.html` con un servidor local. No abras directamente con `file://` si el navegador bloquea módulos.

## 3. Cloudflare Pages
Sube este proyecto a un repositorio GitHub y conéctalo a Cloudflare Pages.

Build command: ninguno.
Output directory: `/`

## Funciones de V1
- Login privado.
- Agregar / editar / eliminar participantes.
- Los registros históricos se conservan aunque se desactive una participante.
- Selección de fecha.
- Estado: votó / justificada / pendiente.
- Motivos personalizados.
- Subida de comprobante.
- Estadísticas diarias.
- Diseño morado con foto de BTS y animaciones suaves.

## Nota
La eliminación de una participante la marca como inactiva para conservar sus registros históricos. No hay papelera ni sección de eliminadas.
