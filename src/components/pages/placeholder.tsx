import { AppShell } from "@/components/app-shell";

export async function Placeholder({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">
            Раздел «{title}» в разработке
          </p>
        </div>
      </div>
    </AppShell>
  );
}