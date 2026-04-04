import { describe, expect, it } from "vitest";
import {
  mapProductDetailQueryRow,
  mapProductStatusRow,
  mapProductStatusRows,
  parseStoreProductDetail,
  type ProductDetailQueryRow,
} from "@/types/supabaseQueryResults";

function baseProductDetailRow(over: Partial<ProductDetailQueryRow> = {}): ProductDetailQueryRow {
  return {
    id: "p1",
    name: "Prod",
    description: null,
    features_text: null,
    game_id: "g1",
    image_url: null,
    active: true,
    created_at: null,
    robot_game_id: null,
    robot_markup_percent: null,
    sort_order: null,
    status: null,
    status_label: null,
    status_updated_at: null,
    product_plans: null,
    product_media: null,
    product_features: null,
    ...over,
  };
}

describe("supabaseQueryResults mappers", () => {
  it("mapProductDetailQueryRow normalizes nested rows and video media", () => {
    const out = mapProductDetailQueryRow(
      baseProductDetailRow({
        product_plans: [
          {
            id: "pl1",
            name: "Plan",
            price: 10,
            active: true,
            sort_order: 2,
            product_id: "p1",
            created_at: null,
            robot_duration_days: null,
          },
        ],
        product_media: [
          {
            id: "m1",
            media_type: "video",
            url: "https://x",
            sort_order: 0,
            product_id: "p1",
            created_at: null,
          },
        ],
        product_features: [
          {
            id: "f1",
            label: "L",
            value: "V",
            sort_order: 1,
            product_id: "p1",
            created_at: null,
          },
        ],
      }),
    );
    expect(out.product_plans).toHaveLength(1);
    expect(out.product_plans[0].price).toBe(10);
    expect(out.product_media[0].media_type).toBe("video");
    expect(out.product_features[0].label).toBe("L");
  });

  it("mapProductStatusRow uses games.name", () => {
    expect(
      mapProductStatusRow({
        id: "1",
        name: "N",
        image_url: null,
        status: null,
        status_label: null,
        games: { name: "Valorant" },
      }),
    ).toMatchObject({ game_name: "Valorant" });
  });

  it("parseStoreProductDetail returns null for invalid payload", () => {
    expect(parseStoreProductDetail(null)).toBeNull();
    expect(parseStoreProductDetail({ id: "x" })).toBeNull();
    expect(parseStoreProductDetail({ id: "x", name: "y", product_plans: [{}] })).toBeNull();
  });

  it("parseStoreProductDetail maps valid minimal payload", () => {
    const row = baseProductDetailRow();
    const out = parseStoreProductDetail(row);
    expect(out).not.toBeNull();
    expect(out!.id).toBe("p1");
    expect(out!.name).toBe("Prod");
  });

  it("mapProductStatusRows skips invalid rows", () => {
    expect(
      mapProductStatusRows([
        { id: "1", name: "A", image_url: null, status: null, status_label: null, games: null },
        null,
        { foo: 1 },
      ]),
    ).toHaveLength(1);
  });
});
