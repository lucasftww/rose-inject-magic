import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackSpaPageView } from "@/lib/metaPixel";

const RouteTracker = () => {
  const location = useLocation();
  const skipInitialMetaPageView = useRef(true);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (skipInitialMetaPageView.current) {
      skipInitialMetaPageView.current = false;
      return;
    }
    trackSpaPageView();
  }, [location.pathname, location.search]);

  return null;
};

export default RouteTracker;
