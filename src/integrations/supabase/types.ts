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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cash_entries: {
        Row: {
          amount: number
          cash_session_id: string | null
          created_at: string
          description: string | null
          entry_type: string
          expense_id: string | null
          id: string
          movement_id: string | null
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          created_at?: string
          description?: string | null
          entry_type?: string
          expense_id?: string | null
          id?: string
          movement_id?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          created_at?: string
          description?: string | null
          entry_type?: string
          expense_id?: string | null
          id?: string
          movement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          created_at: string
          difference: number | null
          expected_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_balance: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          difference?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          difference?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          cep: string | null
          city: string | null
          complement: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          phone: string | null
          state: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method_id: string | null
          recurring: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          recurring?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          recurring?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          counted_quantity: number
          created_at: string
          difference: number
          id: string
          movement_id: string | null
          previous_quantity: number
          product_id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          counted_quantity: number
          created_at?: string
          difference: number
          id?: string
          movement_id?: string | null
          previous_quantity: number
          product_id: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          counted_quantity?: number
          created_at?: string
          difference?: number
          id?: string
          movement_id?: string | null
          previous_quantity?: number
          product_id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          returned_from_id: string | null
          sale_id: string | null
          status: Database["public"]["Enums"]["movement_status"] | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          returned_from_id?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["movement_status"] | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          returned_from_id?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["movement_status"] | null
          type?: Database["public"]["Enums"]["movement_type"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_returned_from_id_fkey"
            columns: ["returned_from_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          fee_percent: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fee_percent?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fee_percent?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          color: string | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          min_quantity: number
          model: string | null
          name: string
          price: number
          quantity: number
          size: string | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          color?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          min_quantity?: number
          model?: string | null
          name: string
          price?: number
          quantity?: number
          size?: string | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          color?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          min_quantity?: number
          model?: string | null
          name?: string
          price?: number
          quantity?: number
          size?: string | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          subtotal: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          subtotal?: number | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          subtotal?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_date: string
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_date?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_date?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          movement_id: string | null
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          movement_id?: string | null
          product_id: string
          quantity: number
          sale_id: string
          subtotal?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          movement_id?: string | null
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_session_id: string | null
          created_at: string
          customer_id: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method_id: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cash_session_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cash_session_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "financeiro" | "estoquista"
      movement_status: "proposta" | "entregue" | "pago"
      movement_type: "in" | "out"
      purchase_status: "draft" | "received" | "cancelled"
      sale_status: "proposta" | "entregue" | "pago" | "devolvida"
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
      app_role: ["admin", "vendedor", "financeiro", "estoquista"],
      movement_status: ["proposta", "entregue", "pago"],
      movement_type: ["in", "out"],
      purchase_status: ["draft", "received", "cancelled"],
      sale_status: ["proposta", "entregue", "pago", "devolvida"],
    },
  },
} as const
