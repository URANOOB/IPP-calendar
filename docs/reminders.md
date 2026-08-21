# Recordatorios de clases

La función `send-class-reminders` se ejecuta cada 15 minutos desde Supabase Cron. Usa Resend únicamente para el profesor y el gestor de contacto; nunca para acudientes.

## Secretos de Edge Functions

Configura en Supabase (no en el repositorio):

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=IPP Clases <clases@inglespalapaz.com>
REMINDER_CRON_SECRET=<valor aleatorio largo>
APP_URL=https://app.inglespalapaz.com
```

Con CLI: `supabase secrets set --env-file supabase/functions/.env`. El archivo local debe ignorarse por Git.

## Cron y Vault

Antes de habilitar envíos en producción, guarda en Vault el URL del proyecto y el mismo secreto de cron:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'ipp_project_url');
select vault.create_secret('<mismo REMINDER_CRON_SECRET>', 'ipp_reminder_cron_secret');
```

La migración crea el único trabajo `send-class-reminders-every-15-minutes`. Sin esos secretos, el trabajo no hace nada.

## Dominio de Resend

Verifica `inglespalapaz.com` en Resend y publica los registros DNS SPF/DKIM que Resend entregue. Solo después usa un remitente del dominio verificado, por ejemplo `IPP Clases <clases@inglespalapaz.com>`.

Para desarrollo, usa una API key de pruebas y un destinatario autorizado por Resend. El proveedor conserva la idempotencia por 24 horas; la tabla `class_reminders` es la protección persistente principal.
