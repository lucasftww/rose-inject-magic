import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { reviews } from "./reviewsData";
import { fadeUp, staggerContainer, slideInLeft } from "./animations";
import { useTranslation } from "react-i18next";

const ReviewsSection = () => {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border bg-background px-5 sm:px-6 py-12 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={slideInLeft}>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-success">{t("reviews.subtitle")}</p>
          <h2
            className="mt-2 sm:mt-3 text-2xl sm:text-5xl font-bold tracking-tight text-foreground md:text-7xl"
            style={{ fontFamily: "'Valorant', sans-serif" }}
          >
            {t("reviews.title")}
          </h2>
        </motion.div>

        {/* Mobile: horizontal scroll carousel */}
        <div className="mt-8 sm:mt-14 sm:hidden">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 snap-x snap-mandatory">
            {reviews.slice(0, 6).map((review, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 min-w-[280px] max-w-[300px] shrink-0 snap-center"
              >
                <div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-success text-success" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.text}</p>
                </div>
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20 text-xs font-bold text-success">
                    {review.name.charAt(0)}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{review.name}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-3">
            <Link to="/avaliacoes" className="text-sm font-medium text-success">{t("reviews.viewAll")}</Link>
          </div>
        </div>

        {/* Desktop grid */}
        <motion.div
          className="mt-14 hidden sm:grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={staggerContainer}
        >
          {reviews.map((review, idx) => (
            <motion.div
              key={idx}
              variants={fadeUp}
              custom={idx}
              className="flex flex-col justify-between rounded-lg border border-border bg-card p-6 transition-all hover:border-success/40 hover:shadow-[0_0_20px_hsl(197,100%,50%,0.1)]"
            >
              <div>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < review.rating ? "fill-success text-success" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{review.text}</p>
              </div>
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-sm font-bold text-success">
                  {review.name.charAt(0)}
                </div>
                <p className="text-sm font-semibold text-foreground">{review.name}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ReviewsSection;
