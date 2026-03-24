export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: "customer" | "business";
          created_at: string;
        };
        Insert: { id: string; name: string; role: "customer" | "business" };
        Update: { name?: string; role?: "customer" | "business" };
      };
      cards: {
        Row: {
          id: string;
          user_id: string;
          qr_token: string;
          created_at: string;
        };
        Insert: { user_id: string; qr_token: string };
        Update: never;
      };
      businesses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          wp_post_id: number | null;
          created_at: string;
        };
        Insert: { user_id: string; name: string; wp_post_id?: number | null };
        Update: { name?: string; wp_post_id?: number | null };
      };
      offers: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          description: string | null;
          terms: string | null;
          redemption_type: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          title: string;
          description?: string | null;
          terms?: string | null;
          redemption_type: string;
          is_active?: boolean;
        };
        Update: {
          title?: string;
          description?: string | null;
          terms?: string | null;
          redemption_type?: string;
          is_active?: boolean;
        };
      };
      redemptions: {
        Row: {
          id: string;
          card_id: string;
          offer_id: string;
          business_id: string;
          redeemed_at: string;
          redeemed_by: string;
        };
        Insert: {
          card_id: string;
          offer_id: string;
          business_id: string;
          redeemed_by: string;
        };
        Update: never;
      };
    };
  };
}
