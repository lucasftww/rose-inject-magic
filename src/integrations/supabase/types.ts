export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_access_log: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          ip_hint: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          ip_hint?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          ip_hint?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coupon_products: {
        Row: {
          coupon_id: string
          id: string
          product_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          product_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_products_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_users: {
        Row: {
          coupon_id: string
          id: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_users_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          current_uses: number | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order_value: number | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          current_uses?: number | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_value?: number | null
        }
        Relationships: []
      }
      games: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      lzt_config: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          markup_fortnite: number | null
          markup_lol: number | null
          markup_minecraft: number | null
          markup_multiplier: number | null
          markup_valorant: number | null
          max_fetch_price: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          markup_fortnite?: number | null
          markup_lol?: number | null
          markup_minecraft?: number | null
          markup_multiplier?: number | null
          markup_valorant?: number | null
          max_fetch_price?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          markup_fortnite?: number | null
          markup_lol?: number | null
          markup_minecraft?: number | null
          markup_multiplier?: number | null
          markup_valorant?: number | null
          max_fetch_price?: number | null
        }
        Relationships: []
      }
      lzt_price_overrides: {
        Row: {
          created_at: string | null
          custom_price_brl: number
          id: string
          lzt_item_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_price_brl: number
          id?: string
          lzt_item_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_price_brl?: number
          id?: string
          lzt_item_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lzt_sales: {
        Row: {
          buy_price: number | null
          buyer_user_id: string | null
          created_at: string | null
          game: string | null
          id: string
          lzt_item_id: string | null
          profit: number | null
          sell_price: number | null
          title: string | null
        }
        Insert: {
          buy_price?: number | null
          buyer_user_id?: string | null
          created_at?: string | null
          game?: string | null
          id?: string
          lzt_item_id?: string | null
          profit?: number | null
          sell_price?: number | null
          title?: string | null
        }
        Update: {
          buy_price?: number | null
          buyer_user_id?: string | null
          created_at?: string | null
          game?: string | null
          id?: string
          lzt_item_id?: string | null
          profit?: number | null
          sell_price?: number | null
          title?: string | null
        }
        Relationships: []
      }
      order_tickets: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          product_id: string
          product_plan_id: string
          status: string | null
          status_label: string | null
          stock_item_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_id: string
          product_plan_id: string
          status?: string | null
          status_label?: string | null
          stock_item_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string
          product_plan_id?: string
          status?: string | null
          status_label?: string | null
          stock_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tickets_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          label: string | null
          method: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          label?: string | null
          method: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          label?: string | null
          method?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          cart_snapshot: Json | null
          charge_id: string | null
          coupon_id: string | null
          created_at: string | null
          discount_amount: number | null
          external_id: string | null
          id: string
          meta_tracking: Json | null
          paid_at: string | null
          payment_method: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          cart_snapshot?: Json | null
          charge_id?: string | null
          coupon_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          external_id?: string | null
          id?: string
          meta_tracking?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          cart_snapshot?: Json | null
          charge_id?: string | null
          coupon_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          external_id?: string | null
          id?: string
          meta_tracking?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_features: {
        Row: {
          created_at: string | null
          id: string
          label: string
          product_id: string
          sort_order: number | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label: string
          product_id: string
          sort_order?: number | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          product_id?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string | null
          id: string
          media_type: string
          product_id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_type?: string
          product_id: string
          sort_order?: number | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_type?: string
          product_id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_plans: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          price: number | null
          product_id: string
          robot_duration_days: number | null
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          price?: number | null
          product_id: string
          robot_duration_days?: number | null
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          price?: number | null
          product_id?: string
          robot_duration_days?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          rating?: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tutorials: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          tutorial_file_url: string | null
          tutorial_text: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          tutorial_file_url?: string | null
          tutorial_text?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          tutorial_file_url?: string | null
          tutorial_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tutorials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tutorials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          features_text: string | null
          game_id: string | null
          id: string
          image_url: string | null
          name: string
          robot_game_id: number | null
          robot_markup_percent: number | null
          sort_order: number | null
          status: string | null
          status_label: string | null
          status_updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          features_text?: string | null
          game_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          robot_game_id?: number | null
          robot_markup_percent?: number | null
          sort_order?: number | null
          status?: string | null
          status_label?: string | null
          status_updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          features_text?: string | null
          game_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
          robot_game_id?: number | null
          robot_markup_percent?: number | null
          sort_order?: number | null
          status?: string | null
          status_label?: string | null
          status_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean | null
          banned_at: string | null
          banned_reason: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      reseller_products: {
        Row: {
          id: string
          product_id: string
          reseller_id: string
        }
        Insert: {
          id?: string
          product_id: string
          reseller_id: string
        }
        Update: {
          id?: string
          product_id?: string
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_products_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_purchases: {
        Row: {
          created_at: string | null
          id: string
          original_price: number | null
          paid_price: number | null
          reseller_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_price?: number | null
          paid_price?: number | null
          reseller_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          original_price?: number | null
          paid_price?: number | null
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_purchases_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          active: boolean | null
          created_at: string | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          total_purchases: number | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          total_purchases?: number | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          total_purchases?: number | null
          user_id?: string
        }
        Relationships: []
      }
      scratch_card_config: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          price: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          price?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          price?: number | null
        }
        Relationships: []
      }
      scratch_card_plays: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          grid_data: Json | null
          id: string
          payment_id: string | null
          prize_id: string | null
          user_id: string
          won: boolean | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          grid_data?: Json | null
          id?: string
          payment_id?: string | null
          prize_id?: string | null
          user_id: string
          won?: boolean | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          grid_data?: Json | null
          id?: string
          payment_id?: string | null
          prize_id?: string | null
          user_id?: string
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "scratch_card_plays_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_card_plays_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "public_scratch_card_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_card_plays_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "scratch_card_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      scratch_card_prizes: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          prize_value: number | null
          product_id: string | null
          sort_order: number | null
          win_percentage: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          prize_value?: number | null
          product_id?: string | null
          sort_order?: number | null
          win_percentage?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          prize_value?: number | null
          product_id?: string | null
          sort_order?: number | null
          win_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scratch_card_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_card_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          content: string
          created_at: string | null
          id: string
          product_plan_id: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          product_plan_id: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          product_plan_id?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_product_plan_id_fkey"
            columns: ["product_plan_id"]
            isOneToOne: false
            referencedRelation: "product_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_credentials: {
        Row: {
          created_at: string | null
          description: string | null
          env_key: string
          help_url: string | null
          id: string
          name: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          env_key: string
          help_url?: string | null
          id?: string
          name: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          env_key?: string
          help_url?: string | null
          id?: string
          name?: string
          value?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_id: string
          sender_role: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_id: string
          sender_role?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_id?: string
          sender_role?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "order_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_ips: {
        Row: {
          id: string
          ip_address: string
          logged_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address: string
          logged_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string
          logged_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_product_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          product_id: string | null
          rating: number | null
          username: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      public_products: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          features_text: string | null
          game_id: string | null
          id: string | null
          image_url: string | null
          name: string | null
          robot_game_id: number | null
          sort_order: number | null
          status: string | null
          status_label: string | null
          status_updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          features_text?: string | null
          game_id?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          robot_game_id?: number | null
          sort_order?: number | null
          status?: string | null
          status_label?: string | null
          status_updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          features_text?: string | null
          game_id?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          robot_game_id?: number | null
          sort_order?: number | null
          status?: string | null
          status_label?: string | null
          status_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      public_scratch_card_prizes: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          name: string | null
          product_id: string | null
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          product_id?: string | null
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          product_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scratch_card_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scratch_card_prizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_finance_summary: { Args: { _since?: string }; Returns: Json }
      admin_lzt_stats: { Args: never; Returns: Json }
      admin_overview_stats: { Args: never; Returns: Json }
      admin_sales_count: { Args: { _status?: string }; Returns: number }
      admin_sales_revenue: { Args: never; Returns: number }
      admin_scratch_stats: { Args: never; Returns: Json }
      admin_verify: { Args: never; Returns: Json }
      claim_stock_item: { Args: { _plan_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_uses: {
        Args: { _coupon_id: string }
        Returns: undefined
      }
      increment_reseller_purchases: {
        Args: { _reseller_id: string }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _cart_product_ids?: string[]; _code: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
