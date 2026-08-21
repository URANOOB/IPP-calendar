"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { signInSchema, type SignInValues } from "@/lib/validations/auth";

export function SignInForm() {
  const [serverError, setServerError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const onSubmit = (values: SignInValues) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await signIn(values);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  };

  return (
    <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">Correo electrónico</label>
        <input
          autoComplete="email"
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isPending}
          id="email"
          type="email"
          {...register("email")}
        />
        {errors.email ? <p className="text-sm text-destructive" role="alert">{errors.email.message}</p> : null}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
        <input
          autoComplete="current-password"
          className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isPending}
          id="password"
          type="password"
          {...register("password")}
        />
        {errors.password ? <p className="text-sm text-destructive" role="alert">{errors.password.message}</p> : null}
      </div>
      {serverError ? <p className="text-sm text-destructive" role="alert">{serverError}</p> : null}
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
