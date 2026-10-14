# ASTOR V4 - plan de recuperacion segura
Fecha: 2026-10-14

Esta rama de trabajo es independiente de la rama historica astor-clinic-restored-20261014 y de main. No publicar datos clinicos.

Hallazgos:
1. El archivo Drive 01_App_Web/index.html actualmente termina cargando app.js?base=1, modo diagnostico, no V4 completa.
2. El informe 2026-08-21 documenta desactivacion temporal de patient.mode.js, patient.menu.guard.js y patient.v13.js para aislar congelamiento.
3. patient.menu.guard.js observa atributos class/style y modifica style; posible realimentacion.
4. patient.v13.js observa childList/subtree y agrega/modifica interfaz; posible realimentacion.
5. El informe de automatizacion V4 registra archivos sin seguimiento Git y modificaciones en index.html y service-worker.js. No asumir que el commit historico del 22 de julio contiene todos esos cambios.
6. Los respaldos V4 de Google Drive deben preservarse y compararse antes de cualquier fusion.
7. Supabase ASTOR: aimtrvetnzlomcnddumf. No conectar Gigantes de Azapa ni Tato Soluciones.
8. Archivos Drive con permiso anyone/writer requieren cierre antes de produccion.

Pendientes de cierre: reconstruccion de V4 desde respaldos, correccion reproducible del bloqueo, validacion de guardado y sincronizacion, autenticacion/RLS, pruebas clinicas con datos sinteticos, QA movil, aprobacion y despliegue controlado.

Regla: no modificar main ni la rama historica, y no afirmar que la aplicacion esta terminada hasta superar pruebas.
