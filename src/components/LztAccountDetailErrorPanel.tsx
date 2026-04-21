import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { errorMessage } from "@/lib/errorMessage";
import { isLztDetailHttpError } from "@/lib/lztAccountDetailFetch";

type Props = {
  error: unknown;
  backTo: string;
  backLabel: string;
};

export function LztAccountDetailErrorPanel({ error, backTo, backLabel }: Props) {
  const gone = isLztDetailHttpError(error, 410);
  const title = gone ? "Esta conta não está mais disponível" : "Erro ao carregar conta";

  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <p className={`text-lg font-semibold ${gone ? "text-foreground" : "text-destructive"}`}>{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      <Link
        to={backTo}
        className="mt-8 inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
    </div>
  );
}
