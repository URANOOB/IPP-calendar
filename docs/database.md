# Modelo de datos y seguridad

La migración inicial está en `supabase/migrations/20260820000100_initial_ipp_schema.sql`. Todos los momentos se guardan como `timestamptz` en UTC; el huso horario de Colombia se aplicará únicamente al presentar datos.

## Decisiones de integridad

- `registrations` conserva `cycle_id` porque la regla principal es `UNIQUE(student_id, cycle_id)`. Una clave foránea compuesta a `classes(id, cycle_id)` impide que el ciclo guardado no sea el ciclo real de la clase.
- `guardian_id` no se duplica en `registrations`: se obtiene de `students.guardian_id`. Así no puede desincronizarse y se mantiene una sola fuente de verdad.
- El teléfono de `guardians` debe estar normalizado a E.164 y es único. Los UUID siguen siendo las claves internas.
- El trigger de `students` bloquea la fila de su acudiente antes de contar, por lo que el límite de diez estudiantes activos se conserva incluso con inserciones concurrentes. Los inactivos permanecen como histórico.
- `contact_tracking` conserva un registro operativo por acudiente (`UNIQUE(guardian_id)`). Un historial de eventos separado podrá añadirse cuando el flujo de seguimiento lo requiera.
- `teachers.notification_email` permite separar el correo operativo de recordatorios del correo de acceso de Auth; si queda vacío, los recordatorios usan el correo de Auth como respaldo. `teachers.avatar_path` apunta a la foto almacenada en el bucket público de perfiles de profesores.

## Seguridad

RLS está habilitado en todas las tablas públicas. No hay políticas `anon` ni acceso de acudientes. Los helpers `security definer` se limitan a `search_path = public`, se revocan de `public` y se conceden solamente a `authenticated`.

- Administradores: administración completa.
- Profesores: consulta de sus clases, inscripciones y los estudiantes/acudientes asociados; actualización limitada a sus propias clases.
- Contact managers: lectura y actualización operativa de acudientes, estudiantes, inscripciones y seguimiento; lectura de ciclos, clases y profesores.

El service role no es necesario en esta tarea y no se configura ni expone en el cliente.

## Alta manual de usuarios internos

No hay registro público ni trigger que cree perfiles automáticamente. Un perfil requiere un rol explícito y no hay un rol seguro por defecto; crear automáticamente un perfil podría otorgar acceso a una cuenta no revisada.

Para preparar un usuario en desarrollo:

1. Créalo desde **Supabase Auth > Users** y confirma su correo si la configuración del proyecto lo requiere.
2. Inserta una fila en `public.profiles` con el mismo UUID de `auth.users`, el nombre completo, un rol de `app_role` válido y `active = true`.
3. Si su rol es `teacher`, inserta el registro relacionado en `public.teachers.profile_id`.

La aplicación considera `profiles` como fuente de verdad. Una cuenta de Auth sin perfil, con perfil inactivo o con un rol inválido no puede entrar al dashboard.

## Enlaces privados de acudientes

Cada invitación se crea con 32 bytes criptográficamente aleatorios y se guarda solo como hash SHA-256 en `guardian_cycle_invitations`. El token en texto plano se entrega una sola vez a quien lo genera; no puede recuperarse después. Varias invitaciones del mismo acudiente y ciclo pueden mantenerse válidas simultáneamente.

La ruta pública resuelve el hash únicamente en servidor mediante una función SQL `security definer` que devuelve exclusivamente el nombre del acudiente y los nombres de sus estudiantes activos. No existe una policy pública de lectura sobre `guardians` ni `students`.

## Ciclos semanales

Los ciclos se almacenan con `timestamptz` en UTC y la interfaz captura/presenta los valores en `America/Bogota`. Un `EXCLUDE` constraint sobre el rango `[starts_at, ends_at)` impide que dos semanas se solapen; además, un índice parcial único permite solo un ciclo con estado `open`.

Los ciclos no se eliminan. Las transiciones permitidas son `draft → open`, `draft → archived`, `open → closed` y `closed → archived`. Las fechas se editan solamente mientras el ciclo está en borrador para preservar el histórico. La ventana efectiva de inscripción se calcula por estado almacenado y por `registration_opens_at` / `registration_closes_at`; un ciclo abierto con cierre vencido no admite inscripciones.

La policy RLS de ciclos permite lectura a personal interno y `INSERT`/`UPDATE` únicamente a administradores. No existe policy `DELETE`, incluso para administradores.

La duplicación de ciclos se dejó como mejora futura: mientras aún no existen clases funcionales, una copia automática podría inducir a interpretar que se copian reservas o configuración operativa. El botón “Crear próxima semana” precarga los rangos relativos de siete días y requiere revisión explícita antes de guardar.

## Oferta de clases

Una clase pertenece a un ciclo y un trigger asegura que su horario esté contenido dentro de ese rango. Una exclusion constraint GiST por `teacher_id` y rango horario impide solapamientos de clases en borrador o publicadas para el mismo profesor; horarios iguales de profesores distintos sí son válidos.

La capacidad es un máximo de estudiantes, no un contador persistido. En la Tarea 7, la reserva deberá calcular las inscripciones que ocupan cupo y crear el registro en una única operación atómica (con bloqueo o RPC), para evitar asignar dos veces el último cupo. Las clases se cancelan, no se eliminan.

## Reserva futura sin carreras

La Tarea 3 deberá crear la inscripción en una transacción de base de datos o función RPC: bloquear la clase (`SELECT ... FOR UPDATE`), contar únicamente inscripciones que ocupen cupo, validar `count < capacity`, e insertar. La restricción única de estudiante/ciclo sigue siendo la defensa final para intentos simultáneos o repetidos. Nunca debe hacerse el conteo y la inserción en dos peticiones independientes.
