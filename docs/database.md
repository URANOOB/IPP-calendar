# Modelo de datos y seguridad

La migración inicial está en `supabase/migrations/20260820000100_initial_ipp_schema.sql`. Todos los momentos se guardan como `timestamptz` en UTC; el huso horario de Colombia se aplicará únicamente al presentar datos.

## Decisiones de integridad

- `registrations` conserva `cycle_id` porque la regla principal es `UNIQUE(student_id, cycle_id)`. Una clave foránea compuesta a `classes(id, cycle_id)` impide que el ciclo guardado no sea el ciclo real de la clase.
- `guardian_id` no se duplica en `registrations`: se obtiene de `students.guardian_id`. Así no puede desincronizarse y se mantiene una sola fuente de verdad.
- El teléfono de `guardians` debe estar normalizado a E.164 y es único. Los UUID siguen siendo las claves internas.
- El trigger de `students` bloquea la fila de su acudiente antes de contar, por lo que el límite de cuatro estudiantes se conserva incluso con inserciones concurrentes.
- `contact_tracking` conserva un registro operativo por acudiente (`UNIQUE(guardian_id)`). Un historial de eventos separado podrá añadirse cuando el flujo de seguimiento lo requiera.

## Seguridad

RLS está habilitado en todas las tablas públicas. No hay políticas `anon` ni acceso de acudientes. Los helpers `security definer` se limitan a `search_path = public`, se revocan de `public` y se conceden solamente a `authenticated`.

- Administradores: administración completa.
- Profesores: consulta de sus clases, inscripciones y los estudiantes/acudientes asociados; actualización limitada a sus propias clases.
- Contact managers: lectura y actualización operativa de acudientes, estudiantes, inscripciones y seguimiento; lectura de ciclos, clases y profesores.

El service role no es necesario en esta tarea y no se configura ni expone en el cliente.

## Reserva futura sin carreras

La Tarea 3 deberá crear la inscripción en una transacción de base de datos o función RPC: bloquear la clase (`SELECT ... FOR UPDATE`), contar únicamente inscripciones que ocupen cupo, validar `count < capacity`, e insertar. La restricción única de estudiante/ciclo sigue siendo la defensa final para intentos simultáneos o repetidos. Nunca debe hacerse el conteo y la inserción en dos peticiones independientes.
