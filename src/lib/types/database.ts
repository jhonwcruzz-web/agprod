// GERADO AUTOMATICAMENTE por tools/gen-types.js — nao editar a mao.
// Regerar apos cada migracao:  node tools/gen-types.js

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          season_id: string | null
          type: string
          title: string
          description: string | null
          due_date: string | null
          done: boolean
          done_date: string | null
          responsible: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          season_id?: string | null
          type?: string
          title: string
          description?: string | null
          due_date?: string | null
          done?: boolean
          done_date?: string | null
          responsible?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          season_id?: string | null
          type?: string
          title?: string
          description?: string | null
          due_date?: string | null
          done?: boolean
          done_date?: string | null
          responsible?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activities_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activities_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      ai_conversations: {
        Row: {
          id: string
          farm_id: string
          user_id: string
          title: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          user_id: string
          title?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          user_id?: string
          title?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_conversations_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_conversations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      ai_messages: {
        Row: {
          id: string
          conversation_id: string
          farm_id: string
          role: string
          content: string
          action: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          farm_id: string
          role: string
          content: string
          action?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          farm_id?: string
          role?: string
          content?: string
          action?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'ai_conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ai_messages_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      alerts: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          kind: string
          severity: Database['public']['Enums']['alert_severity']
          title: string
          message: string | null
          resolved: boolean
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          kind: string
          severity?: Database['public']['Enums']['alert_severity']
          title: string
          message?: string | null
          resolved?: boolean
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          kind?: string
          severity?: Database['public']['Enums']['alert_severity']
          title?: string
          message?: string | null
          resolved?: boolean
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alerts_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          }
        ]
      }
      applications: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          season_id: string | null
          crop_id: string | null
          product_id: string | null
          product_name: string
          active_ingredient: string | null
          dose: number | null
          dose_unit: string | null
          area: number | null
          total_quantity: number | null
          spray_volume: number | null
          equipment: string | null
          responsible: string | null
          cost: number
          status: Database['public']['Enums']['operation_status']
          scheduled_date: string | null
          application_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          machine_id: string | null
          implement_id: string | null
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          season_id?: string | null
          crop_id?: string | null
          product_id?: string | null
          product_name: string
          active_ingredient?: string | null
          dose?: number | null
          dose_unit?: string | null
          area?: number | null
          total_quantity?: number | null
          spray_volume?: number | null
          equipment?: string | null
          responsible?: string | null
          cost?: number
          status?: Database['public']['Enums']['operation_status']
          scheduled_date?: string | null
          application_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          machine_id?: string | null
          implement_id?: string | null
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          season_id?: string | null
          crop_id?: string | null
          product_id?: string | null
          product_name?: string
          active_ingredient?: string | null
          dose?: number | null
          dose_unit?: string | null
          area?: number | null
          total_quantity?: number | null
          spray_volume?: number | null
          equipment?: string | null
          responsible?: string | null
          cost?: number
          status?: Database['public']['Enums']['operation_status']
          scheduled_date?: string | null
          application_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          machine_id?: string | null
          implement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'applications_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_implement_id_fkey'
            columns: ['implement_id']
            isOneToOne: false
            referencedRelation: 'machines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_machine_id_fkey'
            columns: ['machine_id']
            isOneToOne: false
            referencedRelation: 'machines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      audit_logs: {
        Row: {
          id: number
          farm_id: string | null
          user_id: string | null
          table_name: string
          record_id: string | null
          action: string
          changes: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          farm_id?: string | null
          user_id?: string | null
          table_name: string
          record_id?: string | null
          action: string
          changes?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          farm_id?: string | null
          user_id?: string | null
          table_name?: string
          record_id?: string | null
          action?: string
          changes?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      buyers: {
        Row: {
          id: string
          farm_id: string
          name: string
          tax_id: string | null
          phone: string | null
          email: string | null
          location: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          name: string
          tax_id?: string | null
          phone?: string | null
          email?: string | null
          location?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          name?: string
          tax_id?: string | null
          phone?: string | null
          email?: string | null
          location?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'buyers_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      crop_cycles: {
        Row: {
          id: string
          farm_id: string
          plot_id: string
          season_id: string
          crop_id: string | null
          variety_id: string | null
          start_date: string | null
          end_date: string | null
          status: string
          notes: string | null
          created_at: string
          expected_t_ha: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id: string
          season_id: string
          crop_id?: string | null
          variety_id?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          expected_t_ha?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string
          season_id?: string
          crop_id?: string | null
          variety_id?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          expected_t_ha?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'crop_cycles_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crop_cycles_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crop_cycles_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crop_cycles_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'crop_cycles_variety_id_fkey'
            columns: ['variety_id']
            isOneToOne: false
            referencedRelation: 'varieties'
            referencedColumns: ['id']
          }
        ]
      }
      crops: {
        Row: {
          id: string
          slug: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          slug: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          farm_id: string | null
          code: string
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string | null
          code: string
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string | null
          code?: string
          name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expense_categories_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          season_id: string | null
          category: string
          description: string
          amount: number
          expense_date: string
          due_date: string | null
          status: Database['public']['Enums']['payment_status']
          paid_amount: number
          paid_date: string | null
          supplier: string | null
          source_table: string | null
          source_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          is_production_cost: boolean
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          season_id?: string | null
          category?: string
          description: string
          amount: number
          expense_date?: string
          due_date?: string | null
          status?: Database['public']['Enums']['payment_status']
          paid_amount?: number
          paid_date?: string | null
          supplier?: string | null
          source_table?: string | null
          source_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          is_production_cost?: boolean
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          season_id?: string | null
          category?: string
          description?: string
          amount?: number
          expense_date?: string
          due_date?: string | null
          status?: Database['public']['Enums']['payment_status']
          paid_amount?: number
          paid_date?: string | null
          supplier?: string | null
          source_table?: string | null
          source_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          is_production_cost?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      farm_users: {
        Row: {
          farm_id: string
          user_id: string
          role: Database['public']['Enums']['farm_role']
          created_at: string
        }
        Insert: {
          farm_id: string
          user_id: string
          role?: Database['public']['Enums']['farm_role']
          created_at?: string
        }
        Update: {
          farm_id?: string
          user_id?: string
          role?: Database['public']['Enums']['farm_role']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farm_users_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'farm_users_profile_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'farm_users_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      farms: {
        Row: {
          id: string
          name: string
          trade_name: string | null
          owner_name: string | null
          tax_id: string | null
          phone: string | null
          email: string | null
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          community: string | null
          latitude: number | null
          longitude: number | null
          total_area: number
          area_unit: Database['public']['Enums']['area_unit']
          main_activity: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          trade_name?: string | null
          owner_name?: string | null
          tax_id?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          community?: string | null
          latitude?: number | null
          longitude?: number | null
          total_area?: number
          area_unit?: Database['public']['Enums']['area_unit']
          main_activity?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          trade_name?: string | null
          owner_name?: string | null
          tax_id?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          community?: string | null
          latitude?: number | null
          longitude?: number | null
          total_area?: number
          area_unit?: Database['public']['Enums']['area_unit']
          main_activity?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      fertilizations: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          season_id: string | null
          product_id: string | null
          product_name: string
          fert_type: string | null
          quantity: number
          unit: Database['public']['Enums']['quantity_unit']
          dose_per_ha: number | null
          area: number | null
          cost: number
          application_method: string | null
          responsible: string | null
          fertilization_date: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          machine_id: string | null
          implement_id: string | null
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          season_id?: string | null
          product_id?: string | null
          product_name: string
          fert_type?: string | null
          quantity: number
          unit?: Database['public']['Enums']['quantity_unit']
          dose_per_ha?: number | null
          area?: number | null
          cost?: number
          application_method?: string | null
          responsible?: string | null
          fertilization_date?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          machine_id?: string | null
          implement_id?: string | null
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          season_id?: string | null
          product_id?: string | null
          product_name?: string
          fert_type?: string | null
          quantity?: number
          unit?: Database['public']['Enums']['quantity_unit']
          dose_per_ha?: number | null
          area?: number | null
          cost?: number
          application_method?: string | null
          responsible?: string | null
          fertilization_date?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          machine_id?: string | null
          implement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fertilizations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fertilizations_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fertilizations_implement_id_fkey'
            columns: ['implement_id']
            isOneToOne: false
            referencedRelation: 'machines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fertilizations_machine_id_fkey'
            columns: ['machine_id']
            isOneToOne: false
            referencedRelation: 'machines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fertilizations_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fertilizations_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fertilizations_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      harvest_destinations: {
        Row: {
          id: string
          farm_id: string | null
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string | null
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string | null
          name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'harvest_destinations_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          farm_id: string
          product_id: string
          movement_type: Database['public']['Enums']['movement_type']
          quantity: number
          unit_cost: number
          total_cost: number
          movement_date: string
          source_table: string | null
          source_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          product_id: string
          movement_type: Database['public']['Enums']['movement_type']
          quantity: number
          unit_cost?: number
          total_cost?: number
          movement_date?: string
          source_table?: string | null
          source_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          product_id?: string
          movement_type?: Database['public']['Enums']['movement_type']
          quantity?: number
          unit_cost?: number
          total_cost?: number
          movement_date?: string
          source_table?: string | null
          source_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_movements_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_movements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      irrigation_records: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          season_id: string | null
          irrigation_date: string
          duration_minutes: number | null
          volume_m3: number | null
          method: string | null
          cost: number
          responsible: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          season_id?: string | null
          irrigation_date?: string
          duration_minutes?: number | null
          volume_m3?: number | null
          method?: string | null
          cost?: number
          responsible?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          season_id?: string | null
          irrigation_date?: string
          duration_minutes?: number | null
          volume_m3?: number | null
          method?: string | null
          cost?: number
          responsible?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'irrigation_records_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'irrigation_records_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'irrigation_records_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'irrigation_records_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      machine_logs: {
        Row: {
          id: string
          farm_id: string
          machine_id: string
          plot_id: string | null
          season_id: string | null
          log_type: Database['public']['Enums']['machine_log_type']
          log_date: string
          description: string | null
          meter_reading: number | null
          liters: number | null
          cost: number
          next_due_date: string | null
          next_due_meter: number | null
          supplier: string | null
          responsible: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          product_id: string | null
          product_quantity: number | null
        }
        Insert: {
          id?: string
          farm_id: string
          machine_id: string
          plot_id?: string | null
          season_id?: string | null
          log_type?: Database['public']['Enums']['machine_log_type']
          log_date?: string
          description?: string | null
          meter_reading?: number | null
          liters?: number | null
          cost?: number
          next_due_date?: string | null
          next_due_meter?: number | null
          supplier?: string | null
          responsible?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          product_id?: string | null
          product_quantity?: number | null
        }
        Update: {
          id?: string
          farm_id?: string
          machine_id?: string
          plot_id?: string | null
          season_id?: string | null
          log_type?: Database['public']['Enums']['machine_log_type']
          log_date?: string
          description?: string | null
          meter_reading?: number | null
          liters?: number | null
          cost?: number
          next_due_date?: string | null
          next_due_meter?: number | null
          supplier?: string | null
          responsible?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          product_id?: string | null
          product_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'machine_logs_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'machine_logs_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'machine_logs_machine_id_fkey'
            columns: ['machine_id']
            isOneToOne: false
            referencedRelation: 'machines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'machine_logs_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'machine_logs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'machine_logs_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      machines: {
        Row: {
          id: string
          farm_id: string
          class: Database['public']['Enums']['machine_class']
          kind: string | null
          name: string
          brand: string | null
          model: string | null
          year: number | null
          identifier: string | null
          power_hp: number | null
          meter_type: Database['public']['Enums']['meter_type']
          current_meter: number
          acquisition_date: string | null
          acquisition_value: number | null
          coupled_to: string | null
          status: Database['public']['Enums']['machine_status']
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          class?: Database['public']['Enums']['machine_class']
          kind?: string | null
          name: string
          brand?: string | null
          model?: string | null
          year?: number | null
          identifier?: string | null
          power_hp?: number | null
          meter_type?: Database['public']['Enums']['meter_type']
          current_meter?: number
          acquisition_date?: string | null
          acquisition_value?: number | null
          coupled_to?: string | null
          status?: Database['public']['Enums']['machine_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          class?: Database['public']['Enums']['machine_class']
          kind?: string | null
          name?: string
          brand?: string | null
          model?: string | null
          year?: number | null
          identifier?: string | null
          power_hp?: number | null
          meter_type?: Database['public']['Enums']['meter_type']
          current_meter?: number
          acquisition_date?: string | null
          acquisition_value?: number | null
          coupled_to?: string | null
          status?: Database['public']['Enums']['machine_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'machines_coupled_to_fkey'
            columns: ['coupled_to']
            isOneToOne: false
            referencedRelation: 'machines'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'machines_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      media: {
        Row: {
          id: string
          farm_id: string
          entity_type: string
          entity_id: string | null
          kind: string
          storage_path: string
          caption: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          entity_type: string
          entity_id?: string | null
          kind?: string
          storage_path: string
          caption?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          entity_type?: string
          entity_id?: string | null
          kind?: string
          storage_path?: string
          caption?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'media_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      plots: {
        Row: {
          id: string
          farm_id: string
          code: string
          name: string | null
          area: number
          area_unit: Database['public']['Enums']['area_unit']
          crop_id: string | null
          variety_id: string | null
          rootstock_id: string | null
          planting_date: string | null
          plant_count: number | null
          row_spacing: number | null
          plant_spacing: number | null
          irrigation_system: string | null
          training_system: string | null
          status: Database['public']['Enums']['plot_status']
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          code: string
          name?: string | null
          area?: number
          area_unit?: Database['public']['Enums']['area_unit']
          crop_id?: string | null
          variety_id?: string | null
          rootstock_id?: string | null
          planting_date?: string | null
          plant_count?: number | null
          row_spacing?: number | null
          plant_spacing?: number | null
          irrigation_system?: string | null
          training_system?: string | null
          status?: Database['public']['Enums']['plot_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          code?: string
          name?: string | null
          area?: number
          area_unit?: Database['public']['Enums']['area_unit']
          crop_id?: string | null
          variety_id?: string | null
          rootstock_id?: string | null
          planting_date?: string | null
          plant_count?: number | null
          row_spacing?: number | null
          plant_spacing?: number | null
          irrigation_system?: string | null
          training_system?: string | null
          status?: Database['public']['Enums']['plot_status']
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'plots_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plots_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plots_rootstock_id_fkey'
            columns: ['rootstock_id']
            isOneToOne: false
            referencedRelation: 'rootstocks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'plots_variety_id_fkey'
            columns: ['variety_id']
            isOneToOne: false
            referencedRelation: 'varieties'
            referencedColumns: ['id']
          }
        ]
      }
      product_categories: {
        Row: {
          id: string
          farm_id: string | null
          name: string
          expense_category: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string | null
          name: string
          expense_category?: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string | null
          name?: string
          expense_category?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_categories_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      production_records: {
        Row: {
          id: string
          farm_id: string
          plot_id: string | null
          season_id: string | null
          crop_cycle_id: string | null
          crop_id: string | null
          variety_id: string | null
          harvest_date: string
          quantity: number
          unit: Database['public']['Enums']['quantity_unit']
          unit_weight_kg: number | null
          quantity_kg: number
          production_type: string | null
          team: string | null
          destination: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          plot_id?: string | null
          season_id?: string | null
          crop_cycle_id?: string | null
          crop_id?: string | null
          variety_id?: string | null
          harvest_date?: string
          quantity: number
          unit?: Database['public']['Enums']['quantity_unit']
          unit_weight_kg?: number | null
          quantity_kg?: number
          production_type?: string | null
          team?: string | null
          destination?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          plot_id?: string | null
          season_id?: string | null
          crop_cycle_id?: string | null
          crop_id?: string | null
          variety_id?: string | null
          harvest_date?: string
          quantity?: number
          unit?: Database['public']['Enums']['quantity_unit']
          unit_weight_kg?: number | null
          quantity_kg?: number
          production_type?: string | null
          team?: string | null
          destination?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'production_records_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_records_crop_cycle_id_fkey'
            columns: ['crop_cycle_id']
            isOneToOne: false
            referencedRelation: 'crop_cycles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_records_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_records_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_records_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_records_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'production_records_variety_id_fkey'
            columns: ['variety_id']
            isOneToOne: false
            referencedRelation: 'varieties'
            referencedColumns: ['id']
          }
        ]
      }
      products: {
        Row: {
          id: string
          farm_id: string
          name: string
          unit: Database['public']['Enums']['quantity_unit']
          active_ingredient: string | null
          current_stock: number
          min_stock: number
          unit_cost: number
          location: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          category_id: string
        }
        Insert: {
          id?: string
          farm_id: string
          name: string
          unit?: Database['public']['Enums']['quantity_unit']
          active_ingredient?: string | null
          current_stock?: number
          min_stock?: number
          unit_cost?: number
          location?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          category_id: string
        }
        Update: {
          id?: string
          farm_id?: string
          name?: string
          unit?: Database['public']['Enums']['quantity_unit']
          active_ingredient?: string | null
          current_stock?: number
          min_stock?: number
          unit_cost?: number
          location?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      revenues: {
        Row: {
          id: string
          farm_id: string
          season_id: string | null
          sale_id: string | null
          source: string
          description: string
          amount: number
          revenue_date: string
          due_date: string | null
          status: Database['public']['Enums']['payment_status']
          received_amount: number
          received_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          season_id?: string | null
          sale_id?: string | null
          source?: string
          description: string
          amount: number
          revenue_date?: string
          due_date?: string | null
          status?: Database['public']['Enums']['payment_status']
          received_amount?: number
          received_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          season_id?: string | null
          sale_id?: string | null
          source?: string
          description?: string
          amount?: number
          revenue_date?: string
          due_date?: string | null
          status?: Database['public']['Enums']['payment_status']
          received_amount?: number
          received_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'revenues_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'revenues_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'revenues_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'revenues_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          }
        ]
      }
      rootstocks: {
        Row: {
          id: string
          crop_id: string
          farm_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          crop_id: string
          farm_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          crop_id?: string
          farm_id?: string | null
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rootstocks_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rootstocks_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      sales: {
        Row: {
          id: string
          farm_id: string
          buyer_id: string | null
          season_id: string | null
          plot_id: string | null
          crop_id: string | null
          variety_id: string | null
          sale_date: string
          quantity: number
          unit: Database['public']['Enums']['quantity_unit']
          unit_weight_kg: number | null
          quantity_kg: number
          price_per_kg: number
          total_amount: number
          payment_method: string | null
          due_date: string | null
          status: Database['public']['Enums']['payment_status']
          received_amount: number
          received_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          buyer_id?: string | null
          season_id?: string | null
          plot_id?: string | null
          crop_id?: string | null
          variety_id?: string | null
          sale_date?: string
          quantity: number
          unit?: Database['public']['Enums']['quantity_unit']
          unit_weight_kg?: number | null
          quantity_kg?: number
          price_per_kg?: number
          total_amount?: number
          payment_method?: string | null
          due_date?: string | null
          status?: Database['public']['Enums']['payment_status']
          received_amount?: number
          received_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          buyer_id?: string | null
          season_id?: string | null
          plot_id?: string | null
          crop_id?: string | null
          variety_id?: string | null
          sale_date?: string
          quantity?: number
          unit?: Database['public']['Enums']['quantity_unit']
          unit_weight_kg?: number | null
          quantity_kg?: number
          price_per_kg?: number
          total_amount?: number
          payment_method?: string | null
          due_date?: string | null
          status?: Database['public']['Enums']['payment_status']
          received_amount?: number
          received_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sales_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_plot_id_fkey'
            columns: ['plot_id']
            isOneToOne: false
            referencedRelation: 'plots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_season_id_fkey'
            columns: ['season_id']
            isOneToOne: false
            referencedRelation: 'seasons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_variety_id_fkey'
            columns: ['variety_id']
            isOneToOne: false
            referencedRelation: 'varieties'
            referencedColumns: ['id']
          }
        ]
      }
      seasons: {
        Row: {
          id: string
          farm_id: string
          name: string
          start_date: string | null
          end_date: string | null
          is_active: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          name: string
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          name?: string
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'seasons_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
      varieties: {
        Row: {
          id: string
          crop_id: string
          farm_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          crop_id: string
          farm_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          crop_id?: string
          farm_id?: string | null
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'varieties_crop_id_fkey'
            columns: ['crop_id']
            isOneToOne: false
            referencedRelation: 'crops'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'varieties_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      v_buyer_prices: {
        Row: {
          farm_id: string | null
          buyer_id: string | null
          buyer_name: string | null
          sales_count: number | null
          total_kg: number | null
          total_amount: number | null
          received_amount: number | null
          avg_price_per_kg: number | null
        }
        Relationships: []
      }
      v_expense_summary: {
        Row: {
          farm_id: string | null
          season_id: string | null
          category: string | null
          is_production_cost: boolean | null
          unallocated: boolean | null
          entries: number | null
          amount: number | null
          paid_amount: number | null
          open_amount: number | null
          overdue_amount: number | null
        }
        Relationships: []
      }
      v_farm_overview: {
        Row: {
          farm_id: string | null
          season_id: string | null
          production_kg: number | null
          revenue: number | null
          received: number | null
          receivable: number | null
          production_cost: number | null
          cash_out: number | null
          payable: number | null
          result: number | null
          cost_per_kg: number | null
          sold_kg: number | null
          avg_price_per_kg: number | null
        }
        Relationships: []
      }
      v_forecast: {
        Row: {
          farm_id: string | null
          season_id: string | null
          plot_id: string | null
          code: string | null
          area: number | null
          variety_id: string | null
          variety_name: string | null
          crop_name: string | null
          expected_t_ha: number | null
          expected_kg: number | null
          realized_kg: number | null
          realized_t_ha: number | null
          pct_achieved: number | null
        }
        Relationships: []
      }
      v_machine_status: {
        Row: {
          machine_id: string | null
          farm_id: string | null
          class: Database['public']['Enums']['machine_class'] | null
          kind: string | null
          name: string | null
          brand: string | null
          model: string | null
          year: number | null
          meter_type: Database['public']['Enums']['meter_type'] | null
          current_meter: number | null
          status: Database['public']['Enums']['machine_status'] | null
          coupled_to: string | null
          last_service_date: string | null
          next_due_date: string | null
          next_due_meter: number | null
          maintenance_cost: number | null
          fuel_cost: number | null
          fuel_liters: number | null
          due_level: string | null
        }
        Relationships: []
      }
      v_plot_cost_breakdown: {
        Row: {
          farm_id: string | null
          plot_id: string | null
          season_id: string | null
          category: string | null
          amount: number | null
        }
        Relationships: []
      }
      v_plot_performance: {
        Row: {
          plot_id: string | null
          farm_id: string | null
          code: string | null
          name: string | null
          area: number | null
          plant_count: number | null
          crop_name: string | null
          variety_name: string | null
          production_kg: number | null
          total_cost: number | null
          cost_per_kg: number | null
          kg_per_ha: number | null
          revenue: number | null
          result: number | null
        }
        Relationships: []
      }
      v_plot_season_performance: {
        Row: {
          plot_id: string | null
          farm_id: string | null
          season_id: string | null
          code: string | null
          name: string | null
          area: number | null
          plant_count: number | null
          crop_name: string | null
          variety_name: string | null
          production_kg: number | null
          total_cost: number | null
          cost_per_kg: number | null
          kg_per_ha: number | null
          revenue: number | null
          result: number | null
        }
        Relationships: []
      }
      v_revenue_summary: {
        Row: {
          farm_id: string | null
          season_id: string | null
          source: string | null
          entries: number | null
          amount: number | null
          received_amount: number | null
          open_amount: number | null
        }
        Relationships: []
      }
      v_sales_summary: {
        Row: {
          farm_id: string | null
          season_id: string | null
          buyer_id: string | null
          buyer_name: string | null
          sales_count: number | null
          total_kg: number | null
          total_amount: number | null
          received_amount: number | null
        }
        Relationships: []
      }
      v_stock_status: {
        Row: {
          product_id: string | null
          farm_id: string | null
          name: string | null
          category: string | null
          category_id: string | null
          unit: Database['public']['Enums']['quantity_unit'] | null
          current_stock: number | null
          min_stock: number | null
          unit_cost: number | null
          stock_value: number | null
          stock_level: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_severity: 'info' | 'atencao' | 'critico'
      area_unit: 'ha' | 'm2' | 'alqueire'
      farm_role: 'owner' | 'admin' | 'operator' | 'viewer'
      machine_class: 'maquina' | 'implemento'
      machine_log_type: 'preventiva' | 'corretiva' | 'revisao' | 'abastecimento'
      machine_status: 'operacional' | 'manutencao' | 'inativo'
      meter_type: 'horas' | 'km' | 'nenhum'
      movement_type: 'entrada' | 'saida' | 'ajuste'
      operation_status: 'programada' | 'realizada' | 'pendente' | 'cancelada'
      payment_status: 'pendente' | 'parcial' | 'pago'
      plot_status: 'producao' | 'formacao' | 'repouso' | 'inativo'
      quantity_unit: 'kg' | 't' | 'caixa' | 'unidade' | 'L' | 'g' | 'mL' | 'saco' | 'dose'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
