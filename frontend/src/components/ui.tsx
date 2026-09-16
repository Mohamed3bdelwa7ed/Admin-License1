export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-green-50">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-green-100/50">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
}) {
  const tones = {
    default: "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300",
    success: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300",
    warning: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    danger: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  } as const;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-green-100/10 dark:bg-night-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-green-100/50">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-green-50">{value}</p>
          {hint && <p className="mt-1 text-xs text-gray-400 dark:text-green-100/40">{hint}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${tones[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-green-100/10 dark:bg-night-900">
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-green-100/10">
          {title && <h2 className="text-sm font-semibold text-gray-900 dark:text-green-50">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center dark:border-green-100/15 dark:bg-night-900">
      <p className="text-sm font-medium text-gray-500 dark:text-green-100/60">{message}</p>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-green-100/40">{hint}</p>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-green-100/60">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      {label && <p className="mt-3 text-sm">{label}</p>}
    </div>
  );
}
