interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="mb-8">
      {eyebrow ? <p className="mb-2 text-sm font-semibold text-primary">{eyebrow}</p> : null}
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl leading-6 text-muted-foreground">{description}</p>
    </header>
  );
}
