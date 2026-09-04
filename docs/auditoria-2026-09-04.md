# Auditoría operativa — 4 de septiembre de 2026

## Ajuste de contactos y enlaces privados

- La ficha muestra nombre, teléfono y estado; editar contacto y agregar estudiantes se abren a petición. El nombre sigue siendo opcional en administración.
- Crear o editar un contacto en el panel no genera su enlace privado. La ficha muestra «Enlace privado pendiente» y explica que el perfil debe completarse en el formulario general /registro, con una opción para copiar ese enlace.
- /registro es la entrada para contactos precargados con celular y para registros nuevos. Al completar nombre y estudiantes se activa su enlace privado, se muestra en el panel y se usa para elegir clases, confirmarlas y consultar las próximas inscripciones.
- La migración 20260904000600_general_registration_entrypoint.sql registra la finalización del formulario por ciclo, conserva los accesos previamente completados y deja los enlaces antiguos de perfiles incompletos pendientes hasta el registro general. Se retiraron la generación manual y el formulario de alta dentro del enlace privado.
- Se aplicó la migración en Supabase y se verificaron ambos tipos de registro, reutilización de enlaces sin duplicados, inscripción de dos estudiantes en clases distintas y consulta de próximas clases con 020_general_registration_entrypoint.sql, mediante una transacción revertida. Este test sustituye los tests 017–019 del flujo anterior.
- Verificado en navegador: aviso al editar, copia de /registro, creación con solo celular y guardado de nombre sin generar token, enlace incompleto dirigido al formulario y diseño móvil de 320 px. El contacto temporal se eliminó. Compilación correcta. La interfaz sigue pendiente de despliegue.

Se revisaron contactos, estudiantes, profesores, clases, ciclos, seguimiento y el acceso del gestor. Se corrigieron los bloqueos encontrados. La interfaz quedó modificada en el proyecto local; no se publicó un despliegue de la aplicación.

## Cambios principales

- Menú: Dashboard → Profesores → Ciclos → Clases → Contactos → Estudiantes → Seguimiento.
- Guía plegable en el dashboard con el orden de preparación: ciclo, profesores, clases, contactos, estudiantes y seguimiento.
- El gestor puede editar ciclo, profesor, horario y cupo de una clase. El botón de edición de la lista abre directamente el formulario. Crear una clase vuelve a la lista.
- Edición de profesores con activación/desactivación, correo de recordatorios visible y validación de disponibilidad.
- Contactos muestran el nombre y permiten buscar por nombre o celular. Los estudiantes tienen acceso a la edición de su acudiente; el formulario para agregar un estudiante se abre solo a petición y se cierra después de guardar.
- Asistencia mediante selección explícita «Asistió / No asistió», tanto en estudiantes como en la clase. Ya no es necesario marcar primero asistencia para registrar una ausencia. Se puede corregir la última clase aunque el ciclo haya terminado.
- Seguimiento dentro de la página, sin ventana superpuesta; recordatorios plegados inicialmente. Las notas se vacían solo después de guardarse correctamente.
- Seguimiento distingue registrado, interesado y agendado; la próxima clase excluye clases terminadas. La inscripción autónoma no se presenta como prueba de reserva.
- Actualización compartida del dashboard, listados y detalles después de cambios. Los errores de consulta dejan de mostrarse como listas vacías exitosas.
- Calendario corregido para evitar desplazar fechas cuando el navegador usa un huso horario diferente a Bogotá.
- Exportación CSV con BOM UTF-8, protección de celdas interpretables como fórmulas y estados en español. Los errores de consulta devuelven un error de exportación.

## Correcciones de base de datos

La migración `20260904000100_manager_operational_fixes.sql` se aplicó al proyecto Supabase vinculado y se registró como aplicada. No modifica registros operativos ni cuentas existentes.

1. Los helpers de permisos devuelven `false` para perfiles ausentes/inactivos. Antes devolvían `null`, que podía saltarse controles `IF NOT` en funciones privilegiadas.
2. El helper heredado `is_contact_manager()` reconoce al gestor actual. Esto desbloquea crear acudientes y su asignación automática.
3. La validación del perfil del profesor puede comprobar un perfil activo distinto al del gestor sin abrir la lectura general de perfiles.
4. Se restauró el permiso de la función usada por los triggers de cupo e inscripciones.
5. Se habilitó al gestor la carga y sustitución de fotos de profesores. El límite del servidor ahora admite las imágenes de hasta 5 MB que acepta el formulario.
6. Las funciones de directorio/candidatos usan el permiso de personal interno también al instalar desde las migraciones locales.

El gestor mantiene creación, lectura y edición operativa; el borrado permanente de registros operativos y la administración de perfiles siguen reservados al administrador. Administrador y gestor pueden eliminar notificaciones individuales y limpiar el panel de actividad compartida.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| TypeScript, ESLint y compilación de producción | Correctos |
| Inicio de sesión del gestor, menú y guía | Correctos en navegador |
| Siete secciones del panel y navegación móvil de 390 px | Correctas, sin desbordamiento de página ni excepciones del navegador |
| Exportaciones CSV y XLSX con sesión del gestor | HTTP 200 y archivo generado |
| Profesor: crear, editar, desactivar y reactivar | Correcto desde la UI del gestor |
| Ciclo: crear, activar y desactivar | Correcto desde la UI del gestor |
| Clase: crear y editar cupo desde el acceso directo | Correcto desde la UI del gestor |
| Contacto: crear celular y guardar nombre | Correcto desde la UI del gestor |
| Estudiante: crear desde el contacto | Correcto desde la UI del gestor |
| Asistencia: registrar ausencia directamente | Correcto desde la UI del gestor |
| Seguimiento: abrir detalle sin modal y guardar nota | Correcto desde la UI del gestor |
| Edición de estudiantes y ciclos, capacidad, solapamiento y celular duplicado | Correctos mediante pruebas SQL |
| Borrado de contactos, estudiantes, profesores, clases y ciclos | Correcto como administrador mediante RPC |
| Borrado prohibido al gestor y bloqueo de escalamiento de rol | Correctos mediante pruebas SQL |
| Cuenta sin perfil o con perfil inactivo | Rechazada por las funciones probadas |

Pruebas SQL repetibles:

```powershell
npx supabase db query --linked --file supabase/tests/014_rbac_permissions.sql
npx supabase db query --linked --file supabase/tests/015_operational_audit.sql
```

Estas pruebas utilizan transacciones revertidas. Para comprobar los formularios se crearon registros con un identificador exclusivo de auditoría y clases en 2099; al terminar se eliminaron únicamente esos registros y su actividad. La base no tenía datos operativos al comenzar.

## Alcance pendiente de producción

- Publicar los cambios de la aplicación si mañana se utilizará un despliegue remoto; modificar este proyecto local no actualiza ese despliegue.
- No se comprobó entrega real de correos, videollamadas ni envío de WhatsApp. Se verificó configuración de recordatorios, no su entrega externa.
- La subida de fotos se revisó en configuración y permisos SQL; no se realizó una carga de archivo de extremo a extremo.
- El registro general y la activación de enlaces privados se verificaron mediante SQL transaccional; no se realizó una prueba de carga con reservas concurrentes.
- El historial remoto no registra numerosas migraciones históricas presentes en el repositorio aunque su esquema contiene esos cambios. Se aplicó solo la nueva corrección. Antes de ejecutar un despliegue general de migraciones hay que reconciliar ese historial; no reaplicar indiscriminadamente las antiguas.

Los resultados respaldan los flujos enumerados; no constituyen una garantía del 100 % de comportamientos y servicios externos.

## Ajuste posterior: registro de profesores

Por indicación del usuario, se retiró el selector de cuentas. Cada profesor queda asociado al usuario de la sesión, determinado en el servidor. Un gestor puede registrar varios profesores independientes; cada nuevo profesor requiere su propio correo de recordatorios y permite adjuntar su foto antes de guardar, con vista previa y validación de formato y tamaño.

La migración `20260904000200_teacher_registration_owner.sql` se aplicó y registró en el proyecto vinculado. Retira la unicidad por usuario registrador y ajusta el saludo de recordatorios para usar el nombre del profesor.

Se comprobó en navegador la creación de dos profesores desde la misma sesión, con y sin foto; asociación al usuario correcto; rechazo de una imagen de más de 5 MB; vista previa; subida y visualización de la imagen guardada. Los profesores, la foto y la actividad de prueba se eliminaron. Esto completa la comprobación de carga de fotos que había quedado pendiente en la auditoría inicial.

## Ajustes finales de interfaz y permisos

- Selectores compartidos de fechas y horas en español, con horarios de Bogotá.
- Fichas compactas para clases, ciclos, contactos y estudiantes; seguimiento desplegable bajo cada acudiente.
- Confirmaciones propias de la aplicación para eliminar y desactivar; cancelación mediante botón o Escape y manejo de foco.
- Espacio privado de familias con horarios, estados y cuenta regresiva; el enlace personal se puede copiar o mostrar.
- Búsqueda y notificaciones en paneles adaptables que cierran al pulsar fuera o Escape.
- Limpieza individual y completa de notificaciones habilitada para administrador y gestor. La migración 20260904000700 se aplicó al proyecto vinculado; no amplía el borrado de registros operativos.
- Pruebas adicionales: 016_teacher_registration_owner.sql, 020_general_registration_entrypoint.sql y 021_manager_notification_cleanup.sql. La última comprueba borrado individual y masivo, conservación de actividad nueva y rechazo de usuarios anónimos o gestores inactivos. Todas usan rollback.
