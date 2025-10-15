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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_emailaddress: {
        Row: {
          email: string
          id: number
          primary: boolean
          user_id: number
          verified: boolean
        }
        Insert: {
          email: string
          id?: number
          primary: boolean
          user_id: number
          verified: boolean
        }
        Update: {
          email?: string
          id?: number
          primary?: boolean
          user_id?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "account_emailaddress_user_id_2c513194_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      account_emailconfirmation: {
        Row: {
          created: string
          email_address_id: number
          id: number
          key: string
          sent: string | null
        }
        Insert: {
          created: string
          email_address_id: number
          id?: number
          key: string
          sent?: string | null
        }
        Update: {
          created?: string
          email_address_id?: number
          id?: number
          key?: string
          sent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_emailconfirm_email_address_id_5b7f8c58_fk_account_e"
            columns: ["email_address_id"]
            isOneToOne: false
            referencedRelation: "account_emailaddress"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_group: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      auth_group_permissions: {
        Row: {
          group_id: number
          id: number
          permission_id: number
        }
        Insert: {
          group_id: number
          id?: number
          permission_id: number
        }
        Update: {
          group_id?: number
          id?: number
          permission_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "auth_group_permissio_permission_id_84c5c92e_fk_auth_perm"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "auth_permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_group_permissions_group_id_b120cbf9_fk_auth_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "auth_group"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_permission: {
        Row: {
          codename: string
          content_type_id: number
          id: number
          name: string
        }
        Insert: {
          codename: string
          content_type_id: number
          id?: number
          name: string
        }
        Update: {
          codename?: string
          content_type_id?: number
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_permission_content_type_id_2f476e4b_fk_django_co"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "django_content_type"
            referencedColumns: ["id"]
          },
        ]
      }
      authtoken_token: {
        Row: {
          created: string
          key: string
          user_id: number
        }
        Insert: {
          created: string
          key: string
          user_id: number
        }
        Update: {
          created?: string
          key?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "authtoken_token_user_id_35299eff_fk_users_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subject_allocations: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject_id: string
          teacher_id: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject_id: string
          teacher_id?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          description: string
          grade_level: number
          id: number
          name: string
          school_id: number
        }
        Insert: {
          created_at: string
          description: string
          grade_level: number
          id?: number
          name: string
          school_id: number
        }
        Update: {
          created_at?: string
          description?: string
          grade_level?: number
          id?: number
          name?: string
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_a1e3898f_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      django_admin_log: {
        Row: {
          action_flag: number
          action_time: string
          change_message: string
          content_type_id: number | null
          id: number
          object_id: string | null
          object_repr: string
          user_id: number
        }
        Insert: {
          action_flag: number
          action_time: string
          change_message: string
          content_type_id?: number | null
          id?: number
          object_id?: string | null
          object_repr: string
          user_id: number
        }
        Update: {
          action_flag?: number
          action_time?: string
          change_message?: string
          content_type_id?: number | null
          id?: number
          object_id?: string | null
          object_repr?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "django_admin_log_content_type_id_c4bce8eb_fk_django_co"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "django_content_type"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "django_admin_log_user_id_c564eba6_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      django_content_type: {
        Row: {
          app_label: string
          id: number
          model: string
        }
        Insert: {
          app_label: string
          id?: number
          model: string
        }
        Update: {
          app_label?: string
          id?: number
          model?: string
        }
        Relationships: []
      }
      django_migrations: {
        Row: {
          app: string
          applied: string
          id: number
          name: string
        }
        Insert: {
          app: string
          applied: string
          id?: number
          name: string
        }
        Update: {
          app?: string
          applied?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      django_session: {
        Row: {
          expire_date: string
          session_data: string
          session_key: string
        }
        Insert: {
          expire_date: string
          session_data: string
          session_key: string
        }
        Update: {
          expire_date?: string
          session_data?: string
          session_key?: string
        }
        Relationships: []
      }
      django_site: {
        Row: {
          domain: string
          id: number
          name: string
        }
        Insert: {
          domain: string
          id?: number
          name: string
        }
        Update: {
          domain?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      exams_exam: {
        Row: {
          academic_year: number
          class_assigned_id: number
          created_at: string
          created_by_id: number | null
          duration_minutes: number
          exam_date: string
          exam_type_id: number
          id: number
          instructions: string
          is_published: boolean
          max_marks: number
          name: string
          school_id: number | null
          stream_id: number | null
          subject_id: number
          term_id: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          class_assigned_id: number
          created_at: string
          created_by_id?: number | null
          duration_minutes: number
          exam_date: string
          exam_type_id: number
          id?: number
          instructions: string
          is_published: boolean
          max_marks: number
          name: string
          school_id?: number | null
          stream_id?: number | null
          subject_id: number
          term_id: number
          updated_at: string
        }
        Update: {
          academic_year?: number
          class_assigned_id?: number
          created_at?: string
          created_by_id?: number | null
          duration_minutes?: number
          exam_date?: string
          exam_type_id?: number
          id?: number
          instructions?: string
          is_published?: boolean
          max_marks?: number
          name?: string
          school_id?: number | null
          stream_id?: number | null
          subject_id?: number
          term_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_exam_class_assigned_id_7e5c6ac4_fk_classes_id"
            columns: ["class_assigned_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_created_by_id_41730b16_fk_users_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_exam_type_id_08ffd880_fk_exams_examtype_id"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exams_examtype"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_school_id_d5e7f41c_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_stream_id_e7068fd1_fk_streams_id"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_subject_id_8f3e030d_fk_subjects_id"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_term_id_401d671c_fk_settings_termsetting_id"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "settings_termsetting"
            referencedColumns: ["id"]
          },
        ]
      }
      exams_examtype: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          school_id: number
          updated_at: string
        }
        Insert: {
          created_at: string
          description?: string | null
          id?: number
          is_active: boolean
          name: string
          school_id: number
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          school_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_examtype_school_id_f54b8d9b_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      exams_reportcardconfig: {
        Row: {
          academic_year: number
          configured_by_id: number | null
          created_at: string
          id: number
          school_id: number
          term_id: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          configured_by_id?: number | null
          created_at: string
          id?: number
          school_id: number
          term_id: number
          updated_at: string
        }
        Update: {
          academic_year?: number
          configured_by_id?: number | null
          created_at?: string
          id?: number
          school_id?: number
          term_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_reportcardconf_term_id_1d565dd9_fk_settings_"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "settings_termsetting"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_reportcardconfig_configured_by_id_b5e523bd_fk_users_id"
            columns: ["configured_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_reportcardconfig_school_id_921187ef_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      exams_reportcardconfig_exams: {
        Row: {
          exam_id: number
          id: number
          reportcardconfig_id: number
        }
        Insert: {
          exam_id: number
          id?: number
          reportcardconfig_id: number
        }
        Update: {
          exam_id?: number
          id?: number
          reportcardconfig_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_reportcardconf_reportcardconfig_id_45027ad5_fk_exams_rep"
            columns: ["reportcardconfig_id"]
            isOneToOne: false
            referencedRelation: "exams_reportcardconfig"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_reportcardconfig_exams_exam_id_4672bb28_fk_exams_exam_id"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams_exam"
            referencedColumns: ["id"]
          },
        ]
      }
      exams_reportcardexamselection: {
        Row: {
          academic_year: number
          created_at: string
          exam_type_id: number
          id: number
          is_included: boolean
          school_id: number
          term_id: number
        }
        Insert: {
          academic_year: number
          created_at: string
          exam_type_id: number
          id?: number
          is_included: boolean
          school_id: number
          term_id: number
        }
        Update: {
          academic_year?: number
          created_at?: string
          exam_type_id?: number
          id?: number
          is_included?: boolean
          school_id?: number
          term_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_reportcardexam_exam_type_id_f0f44cc4_fk_exams_exa"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exams_examtype"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_reportcardexam_school_id_4443647d_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_reportcardexam_term_id_ce7d6ab8_fk_settings_"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "settings_termsetting"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year: string
          amount: number
          class_id: string | null
          created_at: string
          due_date: string | null
          frequency: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          amount: number
          class_id?: string | null
          created_at?: string
          due_date?: string | null
          frequency: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          amount?: number
          class_id?: string | null
          created_at?: string
          due_date?: string | null
          frequency?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fees_debittransaction: {
        Row: {
          amount: number
          date: string
          id: number
          invoice_number: string
          remarks: string
          school_id: number
          student_id: number
          term: number
          vote_head_id: number
          year: number
        }
        Insert: {
          amount: number
          date: string
          id?: number
          invoice_number: string
          remarks: string
          school_id: number
          student_id: number
          term: number
          vote_head_id: number
          year: number
        }
        Update: {
          amount?: number
          date?: string
          id?: number
          invoice_number?: string
          remarks?: string
          school_id?: number
          student_id?: number
          term?: number
          vote_head_id?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_debittransaction_school_id_059a6c7a_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_debittransaction_student_id_05535c8b_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_debittransaction_vote_head_id_bc2c0005_fk_fees_votehead_id"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_feebalance: {
        Row: {
          amount_invoiced: number
          amount_paid: number
          closing_balance: number
          id: number
          opening_balance: number
          school_id: number
          student_id: number
          term: number
          vote_head_id: number
          year: number
        }
        Insert: {
          amount_invoiced: number
          amount_paid: number
          closing_balance: number
          id?: number
          opening_balance: number
          school_id: number
          student_id: number
          term: number
          vote_head_id: number
          year: number
        }
        Update: {
          amount_invoiced?: number
          amount_paid?: number
          closing_balance?: number
          id?: number
          opening_balance?: number
          school_id?: number
          student_id?: number
          term?: number
          vote_head_id?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_feebalance_school_id_ddea2f81_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_feebalance_student_id_ac2ec66d_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_feebalance_vote_head_id_db2c4b02_fk_fees_votehead_id"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_feestructure: {
        Row: {
          amount: number
          id: number
          school_id: number
          term: number
          vote_head_id: number
          year: number
        }
        Insert: {
          amount: number
          id?: number
          school_id: number
          term: number
          vote_head_id: number
          year: number
        }
        Update: {
          amount?: number
          id?: number
          school_id?: number
          term?: number
          vote_head_id?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_feestructure_school_id_60d48166_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_feestructure_vote_head_id_71e5bae3_fk_fees_votehead_id"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_paymenttransaction: {
        Row: {
          amount: number
          apportion_log: Json
          date: string
          id: number
          mode: string
          remarks: string
          school_id: number
          student_id: number
          transaction_code: string
        }
        Insert: {
          amount: number
          apportion_log: Json
          date: string
          id?: number
          mode: string
          remarks: string
          school_id: number
          student_id: number
          transaction_code: string
        }
        Update: {
          amount?: number
          apportion_log?: Json
          date?: string
          id?: number
          mode?: string
          remarks?: string
          school_id?: number
          student_id?: number
          transaction_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_paymenttransaction_school_id_d8e21a32_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_paymenttransaction_student_id_87a8fde4_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_votehead: {
        Row: {
          description: string
          fee_applicable: boolean
          id: number
          name: string
          priority: number
          school_id: number
          student_group: string
        }
        Insert: {
          description: string
          fee_applicable: boolean
          id?: number
          name: string
          priority: number
          school_id: number
          student_group: string
        }
        Update: {
          description?: string
          fee_applicable?: boolean
          id?: number
          name?: string
          priority?: number
          school_id?: number
          student_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_votehead_school_id_e9528e3f_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_scales: {
        Row: {
          academic_year: number
          grade: string
          id: number
          max_score: number
          min_score: number
          points: number
          remarks: string
          school_id: number
        }
        Insert: {
          academic_year: number
          grade: string
          id?: number
          max_score: number
          min_score: number
          points: number
          remarks: string
          school_id: number
        }
        Update: {
          academic_year?: number
          grade?: string
          id?: number
          max_score?: number
          min_score?: number
          points?: number
          remarks?: string
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_scales_school_id_0cd36924_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          occupation: string | null
          phone: string
          relationship: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          occupation?: string | null
          phone: string
          relationship: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          occupation?: string | null
          phone?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: []
      }
      procurement_feesinkindtransaction: {
        Row: {
          amount: number
          date: string
          id: number
          school_id: number
          student_id: number
          supplier_id: number
          term: number
          vote_head_id: number | null
          year: number
        }
        Insert: {
          amount: number
          date: string
          id?: number
          school_id: number
          student_id: number
          supplier_id: number
          term: number
          vote_head_id?: number | null
          year: number
        }
        Update: {
          amount?: number
          date?: string
          id?: number
          school_id?: number
          student_id?: number
          supplier_id?: number
          term?: number
          vote_head_id?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_feesinki_school_id_a0b6512e_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_feesinki_student_id_9c08e192_fk_students_"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_feesinki_supplier_id_733108ad_fk_procureme"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "procurement_supplier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_feesinki_vote_head_id_8461cd54_fk_fees_vote"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_item: {
        Row: {
          category_id: number
          id: number
          is_consumable: boolean
          name: string
          preferred_supplier_id: number | null
          reorder_level: number
          school_id: number
          unit_price: number
        }
        Insert: {
          category_id: number
          id?: number
          is_consumable: boolean
          name: string
          preferred_supplier_id?: number | null
          reorder_level: number
          school_id: number
          unit_price: number
        }
        Update: {
          category_id?: number
          id?: number
          is_consumable?: boolean
          name?: string
          preferred_supplier_id?: number | null
          reorder_level?: number
          school_id?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_item_category_id_c16c567b_fk_procureme"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "procurement_itemcategory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_item_preferred_supplier_i_cefc56be_fk_procureme"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "procurement_supplier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_item_school_id_c99537d8_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_itemcategory: {
        Row: {
          id: number
          name: string
          school_id: number
        }
        Insert: {
          id?: number
          name: string
          school_id: number
        }
        Update: {
          id?: number
          name?: string
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_itemcate_school_id_ce52e00c_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_lpo: {
        Row: {
          date: string
          id: number
          lpo_number: string
          school_id: number
          status: string
          supplier_id: number
          total_amount: number
        }
        Insert: {
          date: string
          id?: number
          lpo_number: string
          school_id: number
          status: string
          supplier_id: number
          total_amount: number
        }
        Update: {
          date?: string
          id?: number
          lpo_number?: string
          school_id?: number
          status?: string
          supplier_id?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_lpo_school_id_d4212d3d_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_lpo_supplier_id_91833869_fk_procurement_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "procurement_supplier"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_paymentvoucher: {
        Row: {
          amount: number
          date: string
          description: string | null
          id: number
          payment_mode: string
          school_id: number
          status: string
          supplier_id: number
          vote_head_id: number | null
          voucher_number: string
        }
        Insert: {
          amount: number
          date: string
          description?: string | null
          id?: number
          payment_mode: string
          school_id: number
          status: string
          supplier_id: number
          vote_head_id?: number | null
          voucher_number: string
        }
        Update: {
          amount?: number
          date?: string
          description?: string | null
          id?: number
          payment_mode?: string
          school_id?: number
          status?: string
          supplier_id?: number
          vote_head_id?: number | null
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_paymentv_school_id_49e521d7_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_paymentv_supplier_id_5842c78a_fk_procureme"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "procurement_supplier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_paymentv_vote_head_id_3511ac8b_fk_fees_vote"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_pettycashtransaction: {
        Row: {
          amount: number
          date: string
          description: string
          id: number
          related_voucher_id: number | null
          school_id: number
          transaction_type: string
          vote_head_id: number | null
        }
        Insert: {
          amount: number
          date: string
          description: string
          id?: number
          related_voucher_id?: number | null
          school_id: number
          transaction_type: string
          vote_head_id?: number | null
        }
        Update: {
          amount?: number
          date?: string
          description?: string
          id?: number
          related_voucher_id?: number | null
          school_id?: number
          transaction_type?: string
          vote_head_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "procurement_pettycas_related_voucher_id_8ff58cf4_fk_procureme"
            columns: ["related_voucher_id"]
            isOneToOne: false
            referencedRelation: "procurement_paymentvoucher"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_pettycas_school_id_f853e02d_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_pettycas_vote_head_id_abc7751f_fk_fees_vote"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_stocktransaction: {
        Row: {
          description: string | null
          id: number
          issued_to: string | null
          item_id: number
          quantity: number
          related_lpo_id: number | null
          school_id: number
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          description?: string | null
          id?: number
          issued_to?: string | null
          item_id: number
          quantity: number
          related_lpo_id?: number | null
          school_id: number
          transaction_date: string
          transaction_type: string
        }
        Update: {
          description?: string | null
          id?: number
          issued_to?: string | null
          item_id?: number
          quantity?: number
          related_lpo_id?: number | null
          school_id?: number
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "procurement_stocktra_item_id_d7a4aa80_fk_procureme"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "procurement_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_stocktra_related_lpo_id_785cb262_fk_procureme"
            columns: ["related_lpo_id"]
            isOneToOne: false
            referencedRelation: "procurement_lpo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_stocktra_school_id_c921365e_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement_supplier: {
        Row: {
          address: string | null
          category: string | null
          has_student_account: boolean
          id: number
          kra_pin: string | null
          name: string
          opening_balance: number
          phone: string | null
          school_id: number
        }
        Insert: {
          address?: string | null
          category?: string | null
          has_student_account: boolean
          id?: number
          kra_pin?: string | null
          name: string
          opening_balance: number
          phone?: string | null
          school_id: number
        }
        Update: {
          address?: string | null
          category?: string | null
          has_student_account?: boolean
          id?: number
          kra_pin?: string | null
          name?: string
          opening_balance?: number
          phone?: string | null
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_supplier_school_id_ee839706_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      schools_school: {
        Row: {
          active: boolean
          address: string
          code: string
          created_at: string
          email: string
          id: number
          logo: string | null
          motto: string | null
          name: string
          phone: string
          type: string | null
          website: string | null
        }
        Insert: {
          active: boolean
          address: string
          code: string
          created_at: string
          email: string
          id?: number
          logo?: string | null
          motto?: string | null
          name: string
          phone: string
          type?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string
          code?: string
          created_at?: string
          email?: string
          id?: number
          logo?: string | null
          motto?: string | null
          name?: string
          phone?: string
          type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          created_at: string
          entered_by_id: number | null
          exam_id: number
          grade: string
          id: number
          is_absent: boolean
          marks: number
          position: number | null
          remarks: string
          student_id: number
          updated_at: string
        }
        Insert: {
          created_at: string
          entered_by_id?: number | null
          exam_id: number
          grade: string
          id?: number
          is_absent: boolean
          marks: number
          position?: number | null
          remarks: string
          student_id: number
          updated_at: string
        }
        Update: {
          created_at?: string
          entered_by_id?: number | null
          exam_id?: number
          grade?: string
          id?: number
          is_absent?: boolean
          marks?: number
          position?: number | null
          remarks?: string
          student_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_entered_by_id_f5e3f2e1_fk_users_id"
            columns: ["entered_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_exam_id_d6290b08_fk_exams_exam_id"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams_exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_student_id_dfd8f885_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_termsetting: {
        Row: {
          end_date: string
          id: number
          school_id: number
          start_date: string
          term: number
          year: number
        }
        Insert: {
          end_date: string
          id?: number
          school_id: number
          start_date: string
          term: number
          year: number
        }
        Update: {
          end_date?: string
          id?: number
          school_id?: number
          start_date?: string
          term?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "settings_termsetting_school_id_533bfae8_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      socialaccount_socialaccount: {
        Row: {
          date_joined: string
          extra_data: Json
          id: number
          last_login: string
          provider: string
          uid: string
          user_id: number
        }
        Insert: {
          date_joined: string
          extra_data: Json
          id?: number
          last_login: string
          provider: string
          uid: string
          user_id: number
        }
        Update: {
          date_joined?: string
          extra_data?: Json
          id?: number
          last_login?: string
          provider?: string
          uid?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "socialaccount_socialaccount_user_id_8146e70c_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      socialaccount_socialapp: {
        Row: {
          client_id: string
          id: number
          key: string
          name: string
          provider: string
          provider_id: string
          secret: string
          settings: Json
        }
        Insert: {
          client_id: string
          id?: number
          key: string
          name: string
          provider: string
          provider_id: string
          secret: string
          settings: Json
        }
        Update: {
          client_id?: string
          id?: number
          key?: string
          name?: string
          provider?: string
          provider_id?: string
          secret?: string
          settings?: Json
        }
        Relationships: []
      }
      socialaccount_socialapp_sites: {
        Row: {
          id: number
          site_id: number
          socialapp_id: number
        }
        Insert: {
          id?: number
          site_id: number
          socialapp_id: number
        }
        Update: {
          id?: number
          site_id?: number
          socialapp_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "socialaccount_social_site_id_2579dee5_fk_django_si"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "django_site"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socialaccount_social_socialapp_id_97fb6e7d_fk_socialacc"
            columns: ["socialapp_id"]
            isOneToOne: false
            referencedRelation: "socialaccount_socialapp"
            referencedColumns: ["id"]
          },
        ]
      }
      socialaccount_socialtoken: {
        Row: {
          account_id: number
          app_id: number | null
          expires_at: string | null
          id: number
          token: string
          token_secret: string
        }
        Insert: {
          account_id: number
          app_id?: number | null
          expires_at?: string | null
          id?: number
          token: string
          token_secret: string
        }
        Update: {
          account_id?: number
          app_id?: number | null
          expires_at?: string | null
          id?: number
          token?: string
          token_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "socialaccount_social_account_id_951f210e_fk_socialacc"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "socialaccount_socialaccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socialaccount_social_app_id_636a42d7_fk_socialacc"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "socialaccount_socialapp"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          capacity: number
          class_assigned_id: number
          created_at: string
          id: number
          name: string
          school_id: number
          year: number
        }
        Insert: {
          capacity: number
          class_assigned_id: number
          created_at: string
          id?: number
          name: string
          school_id: number
          year: number
        }
        Update: {
          capacity?: number
          class_assigned_id?: number
          created_at?: string
          id?: number
          name?: string
          school_id?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "streams_class_assigned_id_5f727004_fk_classes_id"
            columns: ["class_assigned_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streams_school_id_1018bf12_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          amount_due: number
          amount_paid: number
          balance: number
          created_at: string
          due_date: string
          fee_structure_id: string
          id: string
          status: string
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          balance?: number
          created_at?: string
          due_date: string
          fee_structure_id: string
          id?: string
          status?: string
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          balance?: number
          created_at?: string
          due_date?: string
          fee_structure_id?: string
          id?: string
          status?: string
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      student_promotions: {
        Row: {
          academic_year: number
          created_by_id: number | null
          from_class_id: number | null
          id: number
          notes: string
          promotion_date: string
          student_id: number
          to_class_id: number | null
        }
        Insert: {
          academic_year: number
          created_by_id?: number | null
          from_class_id?: number | null
          id?: number
          notes: string
          promotion_date: string
          student_id: number
          to_class_id?: number | null
        }
        Update: {
          academic_year?: number
          created_by_id?: number | null
          from_class_id?: number | null
          id?: number
          notes?: string
          promotion_date?: string
          student_id?: number
          to_class_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_promotions_created_by_id_0f82a84b_fk_users_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_promotions_from_class_id_494c908f_fk_classes_id"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_promotions_student_id_d95fd7b1_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_promotions_to_class_id_a71069fa_fk_classes_id"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_reports: {
        Row: {
          academic_year: number
          average_marks: number
          class_position: number | null
          generated_at: string
          generated_by_id: number | null
          head_teacher_comment: string
          id: number
          is_published: boolean
          overall_grade: string
          stream_position: number | null
          student_id: number
          teacher_comment: string
          term: number
          total_marks: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          average_marks: number
          class_position?: number | null
          generated_at: string
          generated_by_id?: number | null
          head_teacher_comment: string
          id?: number
          is_published: boolean
          overall_grade: string
          stream_position?: number | null
          student_id: number
          teacher_comment: string
          term: number
          total_marks: number
          updated_at: string
        }
        Update: {
          academic_year?: number
          average_marks?: number
          class_position?: number | null
          generated_at?: string
          generated_by_id?: number | null
          head_teacher_comment?: string
          id?: number
          is_published?: boolean
          overall_grade?: string
          stream_position?: number | null
          student_id?: number
          teacher_comment?: string
          term?: number
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_reports_generated_by_id_69c5326c_fk_users_id"
            columns: ["generated_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_student_id_952f84ce_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transfers: {
        Row: {
          created_by_id: number | null
          from_class_id: number | null
          from_stream_id: number | null
          id: number
          reason: string
          student_id: number
          to_class_id: number | null
          to_stream_id: number | null
          transfer_date: string
        }
        Insert: {
          created_by_id?: number | null
          from_class_id?: number | null
          from_stream_id?: number | null
          id?: number
          reason: string
          student_id: number
          to_class_id?: number | null
          to_stream_id?: number | null
          transfer_date: string
        }
        Update: {
          created_by_id?: number | null
          from_class_id?: number | null
          from_stream_id?: number | null
          id?: number
          reason?: string
          student_id?: number
          to_class_id?: number | null
          to_stream_id?: number | null
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_transfers_created_by_id_f1473f0d_fk_users_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transfers_from_class_id_4081567b_fk_classes_id"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transfers_from_stream_id_fbe0ef8f_fk_streams_id"
            columns: ["from_stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transfers_student_id_6fb5f7c4_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transfers_to_class_id_2410d176_fk_classes_id"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transfers_to_stream_id_db850bbf_fk_streams_id"
            columns: ["to_stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_number: string
          admission_year: number
          created_at: string
          current_class_id: number | null
          current_stream_id: number | null
          date_of_birth: string
          full_name: string
          gender: string
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          guardian_relationship: string
          id: number
          is_active: boolean
          is_on_transport: boolean
          kcpe_index: string
          level: string
          photo: string | null
          school_id: number
          transport_route_id: number | null
          transport_type: string | null
          updated_at: string
        }
        Insert: {
          admission_number: string
          admission_year: number
          created_at: string
          current_class_id?: number | null
          current_stream_id?: number | null
          date_of_birth: string
          full_name: string
          gender: string
          guardian_email: string
          guardian_name: string
          guardian_phone: string
          guardian_relationship: string
          id?: number
          is_active: boolean
          is_on_transport: boolean
          kcpe_index: string
          level: string
          photo?: string | null
          school_id: number
          transport_route_id?: number | null
          transport_type?: string | null
          updated_at: string
        }
        Update: {
          admission_number?: string
          admission_year?: number
          created_at?: string
          current_class_id?: number | null
          current_stream_id?: number | null
          date_of_birth?: string
          full_name?: string
          gender?: string
          guardian_email?: string
          guardian_name?: string
          guardian_phone?: string
          guardian_relationship?: string
          id?: number
          is_active?: boolean
          is_on_transport?: boolean
          kcpe_index?: string
          level?: string
          photo?: string | null
          school_id?: number
          transport_route_id?: number | null
          transport_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_current_class_id_05b7cb5e_fk_classes_id"
            columns: ["current_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_stream_id_585d2899_fk_streams_id"
            columns: ["current_stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_f7f2de45_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_transport_route_id_abe58774_fk_transport"
            columns: ["transport_route_id"]
            isOneToOne: false
            referencedRelation: "transport_transportroute"
            referencedColumns: ["id"]
          },
        ]
      }
      students_classsubjectallocation: {
        Row: {
          academic_year: number
          class_teacher_id: number | null
          id: number
          school_class_id: number
          stream_id: number
          subject_id: number
          subject_teacher_id: number | null
          term: number
        }
        Insert: {
          academic_year: number
          class_teacher_id?: number | null
          id?: number
          school_class_id: number
          stream_id: number
          subject_id: number
          subject_teacher_id?: number | null
          term: number
        }
        Update: {
          academic_year?: number
          class_teacher_id?: number | null
          id?: number
          school_class_id?: number
          stream_id?: number
          subject_id?: number
          subject_teacher_id?: number | null
          term?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_classsubjec_class_teacher_id_212257d5_fk_users_id"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_classsubjec_school_class_id_377c5a19_fk_classes_i"
            columns: ["school_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_classsubjec_stream_id_6395ccf7_fk_streams_i"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_classsubjec_subject_id_26542089_fk_subjects_"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_classsubjec_subject_teacher_id_bdbd3373_fk_users_id"
            columns: ["subject_teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          description: string
          grade_levels: string
          id: number
          is_core: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at: string
          description: string
          grade_levels: string
          id?: number
          is_core: boolean
          name: string
          updated_at: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          grade_levels?: string
          id?: number
          is_core?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_subject_assignments: {
        Row: {
          academic_year: number
          class_assigned_id: number
          created_at: string
          id: number
          is_active: boolean
          stream_id: number | null
          subject_id: number
          teacher_id: number
        }
        Insert: {
          academic_year: number
          class_assigned_id: number
          created_at: string
          id?: number
          is_active: boolean
          stream_id?: number | null
          subject_id: number
          teacher_id: number
        }
        Update: {
          academic_year?: number
          class_assigned_id?: number
          created_at?: string
          id?: number
          is_active?: boolean
          stream_id?: number | null
          subject_id?: number
          teacher_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subject_assi_class_assigned_id_a829856f_fk_classes_i"
            columns: ["class_assigned_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_stream_id_2f463546_fk_streams_id"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_subject_id_4367243b_fk_subjects_id"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_teacher_id_4872c3d5_fk_teachers_id"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          date_joined: string
          date_of_birth: string
          email: string
          full_name: string
          gender: string
          id: number
          is_active: boolean
          phone: string
          tsc_number: string
          updated_at: string
        }
        Insert: {
          created_at: string
          date_joined: string
          date_of_birth: string
          email: string
          full_name: string
          gender: string
          id?: number
          is_active: boolean
          phone: string
          tsc_number: string
          updated_at: string
        }
        Update: {
          created_at?: string
          date_joined?: string
          date_of_birth?: string
          email?: string
          full_name?: string
          gender?: string
          id?: number
          is_active?: boolean
          phone?: string
          tsc_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      transport_transportroute: {
        Row: {
          description: string | null
          id: number
          name: string
          one_way_charge: number
          school_id: number
          two_way_charge: number
        }
        Insert: {
          description?: string | null
          id?: number
          name: string
          one_way_charge: number
          school_id: number
          two_way_charge: number
        }
        Update: {
          description?: string | null
          id?: number
          name?: string
          one_way_charge?: number
          school_id?: number
          two_way_charge?: number
        }
        Relationships: [
          {
            foreignKeyName: "transport_transportr_school_id_6eda93e9_fk_schools_s"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          date_joined: string
          email: string
          first_name: string
          id: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login: string | null
          last_name: string
          password: string
          phone: string
          school_id: number | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at: string
          date_joined: string
          email: string
          first_name: string
          id?: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login?: string | null
          last_name: string
          password: string
          phone: string
          school_id?: number | null
          updated_at: string
          username: string
        }
        Update: {
          created_at?: string
          date_joined?: string
          email?: string
          first_name?: string
          id?: number
          is_active?: boolean
          is_staff?: boolean
          is_superuser?: boolean
          last_login?: string | null
          last_name?: string
          password?: string
          phone?: string
          school_id?: number | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_school_id_00497666_fk_schools_school_id"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      users_groups: {
        Row: {
          group_id: number
          id: number
          user_id: number
        }
        Insert: {
          group_id: number
          id?: number
          user_id: number
        }
        Update: {
          group_id?: number
          id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_groups_group_id_2f3517aa_fk_auth_group_id"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "auth_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_groups_user_id_f500bee5_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users_user_permissions: {
        Row: {
          id: number
          permission_id: number
          user_id: number
        }
        Insert: {
          id?: number
          permission_id: number
          user_id: number
        }
        Update: {
          id?: number
          permission_id?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_user_permissio_permission_id_6d08dcd2_fk_auth_perm"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "auth_permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_user_permissions_user_id_92473840_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_orphaned_school_reference: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_admission_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          date_joined: string
          email: string
          first_name: string
          id: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login: string
          last_name: string
          phone: string
          role: string
          school_id: number
          updated_at: string
          username: string
        }[]
      }
      get_or_create_school_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          address: string
          code: string
          created_at: string
          email: string
          id: number
          logo: string
          motto: string
          name: string
          phone: string
          type: string
          website: string
        }[]
      }
      get_school_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          date_joined: string
          email: string
          first_name: string
          id: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login: string
          last_name: string
          phone: string
          role: string
          school_id: number
          updated_at: string
          username: string
        }[]
      }
      get_user_school_id: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "schooladmin"
        | "finance"
        | "transport"
        | "teacher"
        | "parent"
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
        "superadmin",
        "schooladmin",
        "finance",
        "transport",
        "teacher",
        "parent",
      ],
    },
  },
} as const
