interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="mb-8 border-b border-border/80 pb-6">
      {eyebrow ? <p className="mb-2 text-sm font-bold tracking-wide text-primary">{eyebrow}</p> : null}
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-[2rem]">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl leading-6 text-muted-foreground">{description}</p> : null}
    </header>
  );
}
