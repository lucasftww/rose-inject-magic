import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface ResellerInfo {
  id: string;
  discount_percent: number;
  active: boolean;
  expires_at: string | null;
  productIds: string[]; // empty = all products
}

export const useReseller = () => {
  const { user } = useAuth();
  const [reseller, setReseller] = useState<ResellerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReseller(null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from("resellers")
        .select("id, discount_percent, active, expires_at")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        setReseller(null);
        setLoading(false);
        return;
      }

      const r = data;

      // Check expiration
      if (r.expires_at && new Date(r.expires_at) < new Date()) {
        setReseller(null);
        setLoading(false);
        return;
      }

      // Fetch allowed products
      const { data: prodData } = await supabase
        .from("reseller_products")
        .select("product_id")
        .eq("reseller_id", r.id);

      setReseller({
        id: r.id,
        discount_percent: Number(r.discount_percent),
        active: r.active === true,
        expires_at: r.expires_at,
        productIds: (prodData || []).map((p) => p.product_id).filter((id): id is string => typeof id === "string"),
      });
      setLoading(false);
    };

    fetch();
  }, [user]);

  const isResellerForProduct = (productId: string): boolean => {
    if (!reseller) return false;
    if (reseller.productIds.length === 0) return true; // all products
    return reseller.productIds.includes(productId);
  };

  const getDiscountedPrice = (productId: string, price: number): number | null => {
    if (!isResellerForProduct(productId)) return null;
    return price * (1 - reseller!.discount_percent / 100);
  };

  return {
    reseller,
    loading,
    isReseller: !!reseller,
    isResellerForProduct,
    getDiscountedPrice,
    discountPercent: reseller?.discount_percent || 0,
  };
};
