import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Generate a high quality game cover image for: ${prompt}. Make it visually striking, suitable as a game category thumbnail. 16:9 aspect ratio. Ultra high resolution.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    console.log("AI response structure:", JSON.stringify(data?.choices?.[0]?.message ? { 
      hasContent: !!data.choices[0].message.content,
      hasImages: !!data.choices[0].message.images,
      imagesLength: data.choices[0].message.images?.length,
      keys: Object.keys(data.choices[0].message)
    } : "no message"));

    // Try multiple paths to find the image
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
      || data.choices?.[0]?.message?.images?.[0]?.url
      || data.choices?.[0]?.message?.images?.[0];

    // If still no image in images array, check if content contains base64
    let finalImage = imageUrl;
    if (!finalImage) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.startsWith("data:image")) {
        finalImage = content;
      } else if (Array.isArray(content)) {
        const imgPart = content.find((p: any) => p.type === "image_url" || p.type === "image");
        finalImage = imgPart?.image_url?.url || imgPart?.url;
      }
    }

    if (!finalImage) {
      console.error("Full AI response:", JSON.stringify(data).substring(0, 2000));
      throw new Error("No image generated");
    }

    return new Response(JSON.stringify({ image_base64: finalImage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-game-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
