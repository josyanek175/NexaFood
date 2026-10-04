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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      business_hours: {
        Row: {
          closed: boolean
          closes: string
          created_at: string
          establishment_id: string
          id: string
          opens: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closed?: boolean
          closes?: string
          created_at?: string
          establishment_id: string
          id?: string
          opens?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closed?: boolean
          closes?: string
          created_at?: string
          establishment_id?: string
          id?: string
          opens?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          available_from: string | null
          available_to: string | null
          created_at: string
          establishment_id: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_from?: string | null
          available_to?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_from?: string | null
          available_to?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birthdate: string | null
          consent: boolean
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          last_order_at: string | null
          name: string
          notes: string | null
          orders_count: number
          phone: string
          total_spent: number
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          consent?: boolean
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          last_order_at?: string | null
          name: string
          notes?: string | null
          orders_count?: number
          phone: string
          total_spent?: number
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          consent?: boolean
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          last_order_at?: string | null
          name?: string
          notes?: string | null
          orders_count?: number
          phone?: string
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_users: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establishment_users_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address: string | null
          cnpj: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          email: string | null
          estimated_time_max: number
          estimated_time_min: number
          id: string
          is_open: boolean
          legal_name: string | null
          logo_url: string | null
          minimum_order: number
          name: string
          organization_id: string
          phone: string | null
          primary_color: string
          secondary_color: string
          service_fee_percentage: number
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          email?: string | null
          estimated_time_max?: number
          estimated_time_min?: number
          id?: string
          is_open?: boolean
          legal_name?: string | null
          logo_url?: string | null
          minimum_order?: number
          name: string
          organization_id: string
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          service_fee_percentage?: number
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          email?: string | null
          estimated_time_max?: number
          estimated_time_min?: number
          id?: string
          is_open?: boolean
          legal_name?: string | null
          logo_url?: string | null
          minimum_order?: number
          name?: string
          organization_id?: string
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          service_fee_percentage?: number
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_sectors: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          name: string
          position: number
          printer_name: string | null
          type: Database["public"]["Enums"]["kitchen_sector_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          position?: number
          printer_name?: string | null
          type?: Database["public"]["Enums"]["kitchen_sector_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          position?: number
          printer_name?: string | null
          type?: Database["public"]["Enums"]["kitchen_sector_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_sectors_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          max_select: number
          min_select: number
          name: string
          position: number
          required: boolean
          selection: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          max_select?: number
          min_select?: number
          name: string
          position?: number
          required?: boolean
          selection?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          max_select?: number
          min_select?: number
          name?: string
          position?: number
          required?: boolean
          selection?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      option_items: {
        Row: {
          available: boolean
          created_at: string
          establishment_id: string
          id: string
          name: string
          option_group_id: string
          position: number
          price: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          option_group_id: string
          position?: number
          price?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          option_group_id?: string
          position?: number
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_items_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_options: {
        Row: {
          created_at: string
          establishment_id: string
          group_name: string
          id: string
          item_name: string
          order_item_id: string
          price: number
        }
        Insert: {
          created_at?: string
          establishment_id: string
          group_name: string
          id?: string
          item_name: string
          order_item_id: string
          price?: number
        }
        Update: {
          created_at?: string
          establishment_id?: string
          group_name?: string
          id?: string
          item_name?: string
          order_item_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          notes: string | null
          order_id: string
          position: number
          product_id: string | null
          product_name: string
          quantity: number
          removed: string[]
          sector: string
          unit_price: number
          variation_name: string | null
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          notes?: string | null
          order_id: string
          position?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          removed?: string[]
          sector?: string
          unit_price?: number
          variation_name?: string | null
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          position?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          removed?: string[]
          sector?: string
          unit_price?: number
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          changed_by: string | null
          changed_by_name: string
          created_at: string
          establishment_id: string
          id: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string
          created_at?: string
          establishment_id: string
          id?: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string
          created_at?: string
          establishment_id?: string
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          change_for: number | null
          channel: Database["public"]["Enums"]["order_channel"]
          code: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivery_fee: number
          discount: number
          establishment_id: string
          id: string
          mode: Database["public"]["Enums"]["order_mode"]
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          service_fee: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          table_number: number | null
          total: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          change_for?: number | null
          channel?: Database["public"]["Enums"]["order_channel"]
          code: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_fee?: number
          discount?: number
          establishment_id: string
          id?: string
          mode?: Database["public"]["Enums"]["order_mode"]
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          service_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          table_number?: number | null
          total?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          change_for?: number | null
          channel?: Database["public"]["Enums"]["order_channel"]
          code?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_fee?: number
          discount?: number
          establishment_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["order_mode"]
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          service_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          table_number?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          document: string | null
          id: string
          legal_name: string | null
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document?: string | null
          id?: string
          legal_name?: string | null
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          option_group_id: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          option_group_id: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          option_group_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          name: string
          position: number
          price_delta: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          position?: number
          price_delta?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          position?: number
          price_delta?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string | null
          channels: string[]
          created_at: string
          description: string
          establishment_id: string
          featured: boolean
          id: string
          image_url: string | null
          name: string
          position: number
          prep_minutes: number
          price: number
          promo_price: number | null
          removable_ingredients: string[]
          sector_id: string | null
          sku: string | null
          stock: number | null
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          channels?: string[]
          created_at?: string
          description?: string
          establishment_id: string
          featured?: boolean
          id?: string
          image_url?: string | null
          name: string
          position?: number
          prep_minutes?: number
          price?: number
          promo_price?: number | null
          removable_ingredients?: string[]
          sector_id?: string | null
          sku?: string | null
          stock?: number | null
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          channels?: string[]
          created_at?: string
          description?: string
          establishment_id?: string
          featured?: boolean
          id?: string
          image_url?: string | null
          name?: string
          position?: number
          prep_minutes?: number
          price?: number
          promo_price?: number | null
          removable_ingredients?: string[]
          sector_id?: string | null
          sku?: string | null
          stock?: number | null
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "kitchen_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          active: boolean
          created_at: string
          current_total: number
          establishment_id: string
          id: string
          number: number
          opened_at: string | null
          qr_token: string
          seats: number
          status: Database["public"]["Enums"]["table_status"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_total?: number
          establishment_id: string
          id?: string
          number: number
          opened_at?: string | null
          qr_token?: string
          seats?: number
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          current_total?: number
          establishment_id?: string
          id?: string
          number?: number
          opened_at?: string | null
          qr_token?: string
          seats?: number
          status?: Database["public"]["Enums"]["table_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_establishment: {
        Args: { _establishment_id: string; _user_id?: string }
        Returns: boolean
      }
      establishment_role: {
        Args: { _establishment_id: string; _user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_order_tracking: { Args: { _code: string }; Returns: Json }
      has_establishment_access: {
        Args: { _establishment_id: string; _user_id?: string }
        Returns: boolean
      }
      has_establishment_role: {
        Args: {
          _establishment_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id?: string
        }
        Returns: boolean
      }
      has_organization_access: {
        Args: { _organization_id: string; _user_id?: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean }
      place_order: {
        Args: {
          _address?: string
          _change_for?: number
          _customer_name: string
          _customer_phone?: string
          _items?: Json
          _mode: Database["public"]["Enums"]["order_mode"]
          _notes?: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
          _slug: string
          _table_number?: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "PLATFORM_ADMIN"
        | "ESTABLISHMENT_ADMIN"
        | "MANAGER"
        | "CASHIER"
        | "ATTENDANT"
        | "KITCHEN"
        | "DELIVERY_DRIVER"
      entity_status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "INACTIVE"
      kitchen_sector_type:
        | "COZINHA"
        | "BAR"
        | "CHAPA"
        | "PIZZARIA"
        | "SOBREMESAS"
      order_channel:
        | "CARDAPIO"
        | "MESA"
        | "BALCAO"
        | "IFOOD"
        | "99FOOD"
        | "MANUAL"
      order_mode: "DELIVERY" | "RETIRADA" | "LOCAL"
      order_status:
        | "ENVIADO"
        | "CONFIRMADO"
        | "PREPARANDO"
        | "PRONTO"
        | "EM_ENTREGA"
        | "FINALIZADO"
        | "CANCELADO"
      payment_method: "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "CAIXA"
      table_status:
        | "LIVRE"
        | "OCUPADA"
        | "AGUARDANDO_PEDIDO"
        | "PREPARANDO"
        | "AGUARDANDO_PAGAMENTO"
        | "FECHADA"
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
      app_role: [
        "PLATFORM_ADMIN",
        "ESTABLISHMENT_ADMIN",
        "MANAGER",
        "CASHIER",
        "ATTENDANT",
        "KITCHEN",
        "DELIVERY_DRIVER",
      ],
      entity_status: ["ACTIVE", "SUSPENDED", "TRIAL", "INACTIVE"],
      kitchen_sector_type: [
        "COZINHA",
        "BAR",
        "CHAPA",
        "PIZZARIA",
        "SOBREMESAS",
      ],
      order_channel: [
        "CARDAPIO",
        "MESA",
        "BALCAO",
        "IFOOD",
        "99FOOD",
        "MANUAL",
      ],
      order_mode: ["DELIVERY", "RETIRADA", "LOCAL"],
      order_status: [
        "ENVIADO",
        "CONFIRMADO",
        "PREPARANDO",
        "PRONTO",
        "EM_ENTREGA",
        "FINALIZADO",
        "CANCELADO",
      ],
      payment_method: ["PIX", "CREDITO", "DEBITO", "DINHEIRO", "CAIXA"],
      table_status: [
        "LIVRE",
        "OCUPADA",
        "AGUARDANDO_PEDIDO",
        "PREPARANDO",
        "AGUARDANDO_PAGAMENTO",
        "FECHADA",
      ],
    },
  },
} as const
