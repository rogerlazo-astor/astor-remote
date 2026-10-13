# ASTOR Remote — recuperación exclusiva ASTOR

Estado: EN AUDITORIA. Esta rama no está autorizada para despliegue.

## Hallazgo
La rama main contiene en index.html una página de Gigantes de Azapa. Este contenido NO forma parte de ASTOR Remote.

## Reglas
- No fusionar esta rama en main ni publicar sin validación técnica.
- No copiar ni eliminar datos clínicos o datos del club.
- No reutilizar credenciales, dominios, bases de datos ni buckets entre ASTOR y Gigantes.
- Mantener proyectos Supabase independientes: ASTOR Remote Clinic aimtrvetnzlomcnddumf y Gigantes de Azapa euuzsojkinbwcvtpwoau.
- Bloquear nuevas cargas clínicas reales hasta remediar el almacenamiento público de ASTOR.

## Pendientes verificables
1. Inventario de archivos y dependencias de main y del historial.
2. Localizar el código fuente ASTOR auténtico y verificar su integridad.
3. Copia de seguridad y revisión de secretos, variables y despliegues.
4. Preparar rama limpia exclusivamente ASTOR; eliminar referencias a Gigantes en ella.
5. Pruebas de autenticación, acceso cruzado, RLS y almacenamiento.
6. Revisión humana y aprobación explícita de despliegue.

Esta documentación no certifica que la separación ya se haya completado.
