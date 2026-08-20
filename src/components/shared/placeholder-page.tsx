import { PageHeader } from "@/components/shared/page-header";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="rounded-xl border border-dashed bg-card px-6 py-10 text-sm text-muted-foreground">Módulo en preparación.</section>
    </>
  );
}
