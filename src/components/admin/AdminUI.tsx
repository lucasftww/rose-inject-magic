import { ReactNode, forwardRef } from "react";
import { Loader2, LucideIcon } from "lucide-react";

/* ─── Page Header ─── */
export const AdminPageHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 flex-wrap">
    <div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
    {action}
  </div>
);

/* ─── Primary Button ─── */
export const AdminButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    loading?: boolean;
    icon?: LucideIcon;
    size?: "sm" | "md";
  }
>(({ variant = "primary", loading, icon: Icon, size = "md", children, className = "", disabled, ...props }, ref) => {
  const base = size === "sm"
    ? "rounded-lg px-3 py-1.5 text-xs font-medium"
    : "rounded-lg px-5 py-2.5 text-sm font-semibold";

  const variants = {
    primary: "bg-success text-success-foreground disabled:opacity-50",
    secondary: "border border-border bg-card text-muted-foreground hover:text-foreground",
    danger: "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`flex items-center gap-2 ${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
});
AdminButton.displayName = "AdminButton";

/* ─── Stat Card ─── */
export const AdminStatCard = ({
  icon,
  label,
  value,
  accent = "text-success",
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: string;
  highlight?: boolean;
}) => (
  <div className={`rounded-xl border p-4 ${highlight ? "border-success/30 bg-success/5" : "border-border bg-card"}`}>
    <div className="flex items-center gap-2 mb-1.5">
      <div className={accent}>{icon}</div>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-xl font-bold ${highlight ? "text-success" : "text-foreground"}`}>{value}</p>
  </div>
);

/* ─── Empty State ─── */
export const AdminEmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-muted-foreground">
    <Icon className="h-10 w-10 mb-3 opacity-30" />
    <p className="font-semibold text-sm">{title}</p>
    {description && <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>}
  </div>
);

/* ─── Loading Spinner ─── */
export const AdminLoading = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-success" />
  </div>
);

/* ─── Toggle Switch ─── */
export const AdminToggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) => (
  <label className="flex cursor-pointer items-center gap-3">
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <div className="h-5 w-9 rounded-full border border-border bg-secondary peer-checked:border-success peer-checked:bg-success" />
      <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-foreground/60 peer-checked:left-[18px] peer-checked:bg-success-foreground" />
    </div>
    {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
  </label>
);

/* ─── Input Field ─── */
export const AdminInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; mono?: boolean }
>(({ label, mono, className = "", ...props }, ref) => (
  <div>
    {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
    <input
      ref={ref}
      className={`${label ? "mt-1 " : ""}w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-success/50 ${mono ? "font-mono" : ""} ${className}`}
      {...props}
    />
  </div>
));
AdminInput.displayName = "AdminInput";

/* ─── Filter Chip Button ─── */
export const AdminFilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap ${
      active
        ? "bg-success/20 text-success border border-success/30"
        : "bg-secondary/50 text-muted-foreground border border-border hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

/* ─── Section Card ─── */
export const AdminCard = ({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) => (
  <div className={`rounded-xl border border-border bg-card ${padding ? "p-6" : ""} ${className}`}>
    {children}
  </div>
);

/* ─── Status Badge ─── */
const statusStyles: Record<string, string> = {
  delivered: "bg-success/15 text-success border-success/25",
  open: "bg-warning/15 text-warning border-warning/25",
  waiting: "bg-info/15 text-info border-info/25",
  waiting_staff: "bg-info/15 text-info border-info/25",
  resolved: "bg-positive/15 text-positive border-positive/25",
  closed: "bg-muted/50 text-muted-foreground border-border",
  banned: "bg-destructive/15 text-destructive border-destructive/25",
  finished: "bg-muted/50 text-muted-foreground border-border",
  archived: "bg-muted/50 text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  delivered: "Entregue",
  waiting: "Aguardando",
  waiting_staff: "Aguardando Equipe",
  resolved: "Resolvido",
  closed: "Encerrado",
  banned: "Banido",
  finished: "Finalizado",
  archived: "Arquivado",
};

export const AdminStatusBadge = ({ status, label }: { status: string; label?: string }) => (
  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[status] || "bg-muted/50 text-muted-foreground border-border"}`}>
    {label || statusLabels[status] || status}
  </span>
);

export { statusStyles as adminStatusStyles, statusLabels as adminStatusLabels };
