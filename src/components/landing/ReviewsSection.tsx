import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { reviews } from "./reviewsData";
import { useTranslation } from "react-i18next";

const ReviewsSection = () => {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border bg-background px-4 sm:px-6 py-12 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="text-center sm:text-left">
          <p className="text-[10px] sm:text-sm font-medium uppercase tracking-[0.3em] text-success">{t("reviews.subtitle")}</p>
          <h2 className="mt-1.5 sm:mt-3 text-xl sm:text-4xl font-bold tracking-tight text-foreground md:text-6xl" style={{ fontFamily: "'Valorant', sans-serif" }}>
            {t("reviews.title")}
          </h2>
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="mt-5 sm:hidden">
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-3 -mx-4 px-4 snap-x snap-mandatory touch-pan-x">
            {reviews.slice(0, 6).map((review, idx) => (
              <div key={idx} className="flex flex-col justify-between rounded-xl border border-border/40 bg-card p-3 min-w-[240px] max-w-[260px] shrink-0 snap-center">
                <div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-success text-success" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground line-clamp-4">{review.text}</p>
                </div>
                <div className="mt-2.5 flex items-center gap-2 border-t border-border/40 pt-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/[0.12] text-[9px] font-bold text-success">
                    {review.name.charAt(0)}
                  </div>
                  <p className="text-[10px] font-semibold text-foreground">{review.name}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <Link to="/avaliacoes" className="touch-manipulation text-[10px] font-medium text-success">{t("reviews.viewAll")}</Link>
          </div>
        </div>

        {/* Desktop grid */}
        <div className="mt-12 hidden sm:grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border border-border/40 bg-card p-5 transition-all duration-300 hover:border-success/30 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            >
              <div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-success text-success" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.text}</p>
              </div>
              <div className="mt-4 flex items-center gap-2.5 border-t border-border/40 pt-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/[0.12] text-xs font-bold text-success">
                  {review.name.charAt(0)}
                </div>
                <p className="text-sm font-semibold text-foreground">{review.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
