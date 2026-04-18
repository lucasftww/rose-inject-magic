import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("[404] rota inexistente:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t("notFound.title")}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("notFound.message")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t("notFound.backHome")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
