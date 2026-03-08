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
          {
            foreignKeyName: "account_emailaddress_user_id_2c513194_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
      attendance: {
        Row: {
          academic_year: number
          class_id: number | null
          created_at: string
          date: string
          id: string
          marked_by: number | null
          notes: string | null
          reason: string | null
          status: string
          stream_id: number | null
          student_id: number
          term: number
          time_in: string | null
          time_out: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: number
          class_id?: number | null
          created_at?: string
          date: string
          id?: string
          marked_by?: number | null
          notes?: string | null
          reason?: string | null
          status: string
          stream_id?: number | null
          student_id: number
          term: number
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          class_id?: number | null
          created_at?: string
          date?: string
          id?: string
          marked_by?: number | null
          notes?: string | null
          reason?: string | null
          status?: string
          stream_id?: number | null
          student_id?: number
          term?: number
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: string | null
          module: string
          new_values: Json | null
          old_values: Json | null
          school_id: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          module: string
          new_values?: Json | null
          old_values?: Json | null
          school_id?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          school_id?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
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
          {
            foreignKeyName: "authtoken_token_user_id_35299eff_fk_users_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          parent_id: number | null
          school_id: number
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          parent_id?: number | null
          school_id: number
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          parent_id?: number | null
          school_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
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
      class_subjects: {
        Row: {
          class_id: number
          created_at: string
          id: number
          is_active: boolean
          is_compulsory: boolean
          is_examinable: boolean
          periods_per_week: number | null
          school_id: number
          subject_group_id: number | null
          subject_id: number
          teacher_id: number | null
          updated_at: string
        }
        Insert: {
          class_id: number
          created_at?: string
          id?: number
          is_active?: boolean
          is_compulsory?: boolean
          is_examinable?: boolean
          periods_per_week?: number | null
          school_id: number
          subject_group_id?: number | null
          subject_id: number
          teacher_id?: number | null
          updated_at?: string
        }
        Update: {
          class_id?: number
          created_at?: string
          id?: number
          is_active?: boolean
          is_compulsory?: boolean
          is_examinable?: boolean
          periods_per_week?: number | null
          school_id?: number
          subject_group_id?: number | null
          subject_id?: number
          teacher_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_group_id_fkey"
            columns: ["subject_group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          description?: string
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
          {
            foreignKeyName: "django_admin_log_user_id_c564eba6_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
      exam_marks: {
        Row: {
          created_at: string
          entered_by: number | null
          exam_paper_id: number
          grade: string | null
          id: number
          is_absent: boolean
          is_submitted: boolean
          marks: number | null
          points: number | null
          remarks: string | null
          student_id: number
          submitted_at: string | null
          submitted_by: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entered_by?: number | null
          exam_paper_id: number
          grade?: string | null
          id?: number
          is_absent?: boolean
          is_submitted?: boolean
          marks?: number | null
          points?: number | null
          remarks?: string | null
          student_id: number
          submitted_at?: string | null
          submitted_by?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entered_by?: number | null
          exam_paper_id?: number
          grade?: string | null
          id?: number
          is_absent?: boolean
          is_submitted?: boolean
          marks?: number | null
          points?: number | null
          remarks?: string | null
          student_id?: number
          submitted_at?: string | null
          submitted_by?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_exam_paper_id_fkey"
            columns: ["exam_paper_id"]
            isOneToOne: false
            referencedRelation: "exam_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "exam_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_marks_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_papers: {
        Row: {
          class_id: number
          created_at: string
          duration_minutes: number | null
          exam_date: string | null
          exam_session_id: number
          id: number
          instructions: string | null
          max_marks: number
          paper_name: string
          status: string
          stream_id: number | null
          subject_id: number
          updated_at: string
          weight: number | null
        }
        Insert: {
          class_id: number
          created_at?: string
          duration_minutes?: number | null
          exam_date?: string | null
          exam_session_id: number
          id?: number
          instructions?: string | null
          max_marks?: number
          paper_name: string
          status?: string
          stream_id?: number | null
          subject_id: number
          updated_at?: string
          weight?: number | null
        }
        Update: {
          class_id?: number
          created_at?: string
          duration_minutes?: number | null
          exam_date?: string | null
          exam_session_id?: number
          id?: number
          instructions?: string | null
          max_marks?: number
          paper_name?: string
          status?: string
          stream_id?: number | null
          subject_id?: number
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_papers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_papers_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_papers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_papers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_session_classes: {
        Row: {
          class_id: number
          created_at: string
          exam_session_id: number
          id: number
        }
        Insert: {
          class_id: number
          created_at?: string
          exam_session_id: number
          id?: number
        }
        Update: {
          class_id?: number
          created_at?: string
          exam_session_id?: number
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_session_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_session_classes_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          academic_year: number
          created_at: string
          created_by: number | null
          description: string | null
          end_date: string
          id: number
          is_locked: boolean
          name: string
          school_id: number
          start_date: string
          status: string
          term_id: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          created_at?: string
          created_by?: number | null
          description?: string | null
          end_date: string
          id?: number
          is_locked?: boolean
          name: string
          school_id: number
          start_date: string
          status?: string
          term_id: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          created_at?: string
          created_by?: number | null
          description?: string | null
          end_date?: string
          id?: number
          is_locked?: boolean
          name?: string
          school_id?: number
          start_date?: string
          status?: string
          term_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "settings_termsetting"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "exams_exam_created_by_id_41730b16_fk_users_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
            foreignKeyName: "exams_reportcardconfig_configured_by_id_b5e523bd_fk_users_id"
            columns: ["configured_by_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
      fees_allocation: {
        Row: {
          amount: number
          created_at: string
          id: number
          receipt_id: number
          school_id: number
          vote_head_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          receipt_id: number
          school_id: number
          vote_head_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          receipt_id?: number
          school_id?: number
          vote_head_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_allocation_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "fees_receipt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_allocation_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_allocation_vote_head_id_fkey"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
      fees_ledger_entry: {
        Row: {
          account_credit: string
          account_debit: string
          amount: number
          created_at: string
          description: string
          entry_date: string
          id: number
          receipt_id: number | null
          reference: string
          school_id: number
          student_id: number | null
        }
        Insert: {
          account_credit: string
          account_debit: string
          amount: number
          created_at?: string
          description?: string
          entry_date?: string
          id?: number
          receipt_id?: number | null
          reference?: string
          school_id: number
          student_id?: number | null
        }
        Update: {
          account_credit?: string
          account_debit?: string
          amount?: number
          created_at?: string
          description?: string
          entry_date?: string
          id?: number
          receipt_id?: number | null
          reference?: string
          school_id?: number
          student_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fees_ledger_entry_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "fees_receipt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_ledger_entry_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_ledger_entry_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "fees_ledger_entry_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
      fees_receipt: {
        Row: {
          amount: number
          created_at: string
          id: number
          is_reversed: boolean
          payment_mode: string
          posted_by: number | null
          receipt_no: string
          reference: string
          remarks: string
          school_id: number
          student_id: number
          term: number
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          is_reversed?: boolean
          payment_mode?: string
          posted_by?: number | null
          receipt_no: string
          reference?: string
          remarks?: string
          school_id: number
          student_id: number
          term?: number
          year?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          is_reversed?: boolean
          payment_mode?: string
          posted_by?: number | null
          receipt_no?: string
          reference?: string
          remarks?: string
          school_id?: number
          student_id?: number
          term?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_receipt_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_receipt_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_receipt_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_receipt_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "fees_receipt_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_structure_group: {
        Row: {
          academic_year: number
          created_at: string
          id: number
          is_active: boolean
          name: string
          school_id: number
          student_group: string
          term: number
        }
        Insert: {
          academic_year?: number
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          school_id: number
          student_group?: string
          term?: number
        }
        Update: {
          academic_year?: number
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          school_id?: number
          student_group?: string
          term?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_structure_group_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_structure_item: {
        Row: {
          amount: number
          id: number
          structure_group_id: number
          vote_head_id: number
        }
        Insert: {
          amount: number
          id?: number
          structure_group_id: number
          vote_head_id: number
        }
        Update: {
          amount?: number
          id?: number
          structure_group_id?: number
          vote_head_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_structure_item_structure_group_id_fkey"
            columns: ["structure_group_id"]
            isOneToOne: false
            referencedRelation: "fees_structure_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_structure_item_vote_head_id_fkey"
            columns: ["vote_head_id"]
            isOneToOne: false
            referencedRelation: "fees_votehead"
            referencedColumns: ["id"]
          },
        ]
      }
      fees_student_ledger: {
        Row: {
          balance: number
          credit_total: number
          debit_total: number
          id: number
          last_updated: string
          school_id: number
          student_id: number
        }
        Insert: {
          balance?: number
          credit_total?: number
          debit_total?: number
          id?: number
          last_updated?: string
          school_id: number
          student_id: number
        }
        Update: {
          balance?: number
          credit_total?: number
          debit_total?: number
          id?: number
          last_updated?: string
          school_id?: number
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fees_student_ledger_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_student_ledger_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "fees_student_ledger_student_id_fkey"
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
      journal_entries: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          id: number
          posted_at: string | null
          posted_by: number | null
          reference_number: string
          school_id: number
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          entry_date?: string
          id?: never
          posted_at?: string | null
          posted_by?: number | null
          reference_number: string
          school_id: number
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          id?: never
          posted_at?: string | null
          posted_by?: number | null
          reference_number?: string
          school_id?: number
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: number
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          id: number
          journal_entry_id: number
        }
        Insert: {
          account_id: number
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: never
          journal_entry_id: number
        }
        Update: {
          account_id?: number
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: never
          journal_entry_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: number | null
          created_at: string | null
          days_requested: number
          end_date: string
          id: number
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          staff_id: number
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: number | null
          created_at?: string | null
          days_requested: number
          end_date: string
          id?: number
          leave_type: string
          reason?: string | null
          rejection_reason?: string | null
          staff_id: number
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: number | null
          created_at?: string | null
          days_requested?: number
          end_date?: string
          id?: number
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          staff_id?: number
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          id: number
          identifier: string
          success: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          id?: number
          identifier: string
          success?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          id?: number
          identifier?: string
          success?: boolean | null
        }
        Relationships: []
      }
      onboarding_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: number
          school_id: number
          status: string
          step: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: number
          school_id: number
          status?: string
          step: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: number
          school_id?: number
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          basic_salary: number
          created_at: string
          gross_salary: number
          id: number
          net_salary: number
          paid_at: string | null
          payment_status: string
          payroll_run_id: number
          staff_id: number
          total_allowances: number
          total_deductions: number
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          gross_salary?: number
          id?: never
          net_salary?: number
          paid_at?: string | null
          payment_status?: string
          payroll_run_id: number
          staff_id: number
          total_allowances?: number
          total_deductions?: number
        }
        Update: {
          basic_salary?: number
          created_at?: string
          gross_salary?: number
          id?: never
          net_salary?: number
          paid_at?: string | null
          payment_status?: string
          payroll_run_id?: number
          staff_id?: number
          total_allowances?: number
          total_deductions?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: number | null
          created_at: string
          id: number
          month: number
          school_id: number
          staff_count: number
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: number | null
          created_at?: string
          id?: never
          month: number
          school_id: number
          staff_count?: number
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: number | null
          created_at?: string
          id?: never
          month?: number
          school_id?: number
          staff_count?: number
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_salary_structures: {
        Row: {
          basic_salary: number
          created_at: string
          effective_from: string
          house_allowance: number
          id: number
          is_active: boolean
          loan_deduction: number
          medical_allowance: number
          net_salary: number | null
          nhif_deduction: number
          nssf_deduction: number
          other_allowances: number
          other_deductions: number
          paye_deduction: number
          school_id: number
          staff_id: number
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          effective_from?: string
          house_allowance?: number
          id?: never
          is_active?: boolean
          loan_deduction?: number
          medical_allowance?: number
          net_salary?: number | null
          nhif_deduction?: number
          nssf_deduction?: number
          other_allowances?: number
          other_deductions?: number
          paye_deduction?: number
          school_id: number
          staff_id: number
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          effective_from?: string
          house_allowance?: number
          id?: never
          is_active?: boolean
          loan_deduction?: number
          medical_allowance?: number
          net_salary?: number | null
          nhif_deduction?: number
          nssf_deduction?: number
          other_allowances?: number
          other_deductions?: number
          paye_deduction?: number
          school_id?: number
          staff_id?: number
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_salary_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_salary_structures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
      school_settings: {
        Row: {
          academic_year_start: number | null
          created_at: string
          currency: string | null
          email_notifications: boolean | null
          grading_system: string | null
          id: number
          report_template: string | null
          school_id: number
          sms_enabled: boolean | null
          sms_provider: string | null
          terms_per_year: number | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          academic_year_start?: number | null
          created_at?: string
          currency?: string | null
          email_notifications?: boolean | null
          grading_system?: string | null
          id?: number
          report_template?: string | null
          school_id: number
          sms_enabled?: boolean | null
          sms_provider?: string | null
          terms_per_year?: number | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_start?: number | null
          created_at?: string
          currency?: string | null
          email_notifications?: boolean | null
          grading_system?: string | null
          id?: number
          report_template?: string | null
          school_id?: number
          sms_enabled?: boolean | null
          sms_provider?: string | null
          terms_per_year?: number | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      schools_school: {
        Row: {
          active: boolean
          address: string
          city: string | null
          code: string
          contact_person: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          email: string
          id: number
          logo: string | null
          max_students: number | null
          max_users: number | null
          motto: string | null
          name: string
          phone: string
          subscription_end: string | null
          subscription_plan: string | null
          subscription_start: string | null
          subscription_status: string | null
          type: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address: string
          city?: string | null
          code?: string
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: number
          logo?: string | null
          max_students?: number | null
          max_users?: number | null
          motto?: string | null
          name: string
          phone: string
          subscription_end?: string | null
          subscription_plan?: string | null
          subscription_start?: string | null
          subscription_status?: string | null
          type?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string
          city?: string | null
          code?: string
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: number
          logo?: string | null
          max_students?: number | null
          max_users?: number | null
          motto?: string | null
          name?: string
          phone?: string
          subscription_end?: string | null
          subscription_plan?: string | null
          subscription_start?: string | null
          subscription_status?: string | null
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
            foreignKeyName: "scores_entered_by_id_f5e3f2e1_fk_users_id"
            columns: ["entered_by_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
          {
            foreignKeyName: "socialaccount_socialaccount_user_id_8146e70c_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
      staff_attendance: {
        Row: {
          approved_by: number | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          date: string
          id: number
          leave_type: string | null
          notes: string | null
          staff_id: number
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_by?: number | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date: string
          id?: number
          leave_type?: string | null
          notes?: string | null
          staff_id: number
          status: string
          updated_at?: string | null
        }
        Update: {
          approved_by?: number | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          id?: number
          leave_type?: string | null
          notes?: string | null
          staff_id?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_name_settings: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: number
          is_active: boolean
          name: string
          school_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: number
          is_active?: boolean
          name: string
          school_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: number
          is_active?: boolean
          name?: string
          school_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_name_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
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
          created_at?: string
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
            foreignKeyName: "streams_class_assigned_id_fk_classes"
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
      student_exam_results: {
        Row: {
          average_percentage: number
          average_points: number
          class_id: number
          class_position: number | null
          computed_at: string | null
          created_at: string
          exam_session_id: number
          head_teacher_comment: string | null
          id: number
          is_published: boolean
          overall_grade: string | null
          stream_id: number | null
          stream_position: number | null
          student_id: number
          subject_positions: Json | null
          subjects_count: number
          teacher_comment: string | null
          total_marks: number
          total_points: number
          total_possible: number
          updated_at: string
        }
        Insert: {
          average_percentage?: number
          average_points?: number
          class_id: number
          class_position?: number | null
          computed_at?: string | null
          created_at?: string
          exam_session_id: number
          head_teacher_comment?: string | null
          id?: number
          is_published?: boolean
          overall_grade?: string | null
          stream_id?: number | null
          stream_position?: number | null
          student_id: number
          subject_positions?: Json | null
          subjects_count?: number
          teacher_comment?: string | null
          total_marks?: number
          total_points?: number
          total_possible?: number
          updated_at?: string
        }
        Update: {
          average_percentage?: number
          average_points?: number
          class_id?: number
          class_position?: number | null
          computed_at?: string | null
          created_at?: string
          exam_session_id?: number
          head_teacher_comment?: string | null
          id?: number
          is_published?: boolean
          overall_grade?: string | null
          stream_id?: number | null
          stream_position?: number | null
          student_id?: number
          subject_positions?: Json | null
          subjects_count?: number
          teacher_comment?: string | null
          total_marks?: number
          total_points?: number
          total_possible?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_exam_results_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_exam_results_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_exam_results_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
            foreignKeyName: "student_promotions_created_by_id_0f82a84b_fk_users_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
          average_percentage: number | null
          average_points: number | null
          class_position: number | null
          created_at: string | null
          generated_at: string
          generated_by_id: number | null
          head_teacher_comment: string
          id: number
          is_published: boolean
          overall_grade: string
          principal_remarks: string | null
          school_id: number | null
          stream_position: number | null
          student_id: number
          teacher_comment: string
          teacher_remarks: string | null
          term: number
          term_id: number | null
          total_marks: number
          total_possible_marks: number | null
          total_students_in_class: number | null
          total_students_in_stream: number | null
          updated_at: string
        }
        Insert: {
          academic_year: number
          average_marks: number
          average_percentage?: number | null
          average_points?: number | null
          class_position?: number | null
          created_at?: string | null
          generated_at: string
          generated_by_id?: number | null
          head_teacher_comment: string
          id?: number
          is_published: boolean
          overall_grade: string
          principal_remarks?: string | null
          school_id?: number | null
          stream_position?: number | null
          student_id: number
          teacher_comment: string
          teacher_remarks?: string | null
          term: number
          term_id?: number | null
          total_marks: number
          total_possible_marks?: number | null
          total_students_in_class?: number | null
          total_students_in_stream?: number | null
          updated_at: string
        }
        Update: {
          academic_year?: number
          average_marks?: number
          average_percentage?: number | null
          average_points?: number | null
          class_position?: number | null
          created_at?: string | null
          generated_at?: string
          generated_by_id?: number | null
          head_teacher_comment?: string
          id?: number
          is_published?: boolean
          overall_grade?: string
          principal_remarks?: string | null
          school_id?: number | null
          stream_position?: number | null
          student_id?: number
          teacher_comment?: string
          teacher_remarks?: string | null
          term?: number
          term_id?: number | null
          total_marks?: number
          total_possible_marks?: number | null
          total_students_in_class?: number | null
          total_students_in_stream?: number | null
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
            foreignKeyName: "student_reports_generated_by_id_69c5326c_fk_users_id"
            columns: ["generated_by_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_student_id_952f84ce_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_reports_student_id_952f84ce_fk_students_id"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "settings_termsetting"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subject_allocations: {
        Row: {
          academic_year: number
          class_subject_id: number
          created_at: string
          id: number
          is_active: boolean
          school_id: number
          student_id: number
          term: number
          updated_at: string
        }
        Insert: {
          academic_year?: number
          class_subject_id: number
          created_at?: string
          id?: number
          is_active?: boolean
          school_id: number
          student_id: number
          term?: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          class_subject_id?: number
          created_at?: string
          id?: number
          is_active?: boolean
          school_id?: number
          student_id?: number
          term?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_allocations_class_subject_id_fkey"
            columns: ["class_subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_allocations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_subject_allocations_student_id_fkey"
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
            foreignKeyName: "student_transfers_created_by_id_f1473f0d_fk_users_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
            referencedRelation: "attendance_summary"
            referencedColumns: ["student_id"]
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
          admission_number?: string
          admission_year: number
          created_at?: string
          current_class_id?: number | null
          current_stream_id?: number | null
          date_of_birth: string
          full_name: string
          gender: string
          guardian_email?: string
          guardian_name: string
          guardian_phone: string
          guardian_relationship: string
          id?: number
          is_active?: boolean
          is_on_transport?: boolean
          kcpe_index?: string
          level: string
          photo?: string | null
          school_id: number
          transport_route_id?: number | null
          transport_type?: string | null
          updated_at?: string
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
            foreignKeyName: "students_current_class_id_fk_classes"
            columns: ["current_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_stream_id_fk_streams"
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
            foreignKeyName: "students_classsubjec_class_teacher_id_212257d5_fk_users_id"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
          {
            foreignKeyName: "students_classsubjec_subject_teacher_id_bdbd3373_fk_users_id"
            columns: ["subject_teacher_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: number
          is_active: boolean
          name: string
          school_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: number
          is_active?: boolean
          name: string
          school_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: number
          is_active?: boolean
          name?: string
          school_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_groups: {
        Row: {
          class_id: number
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          max_subjects: number
          min_subjects: number
          name: string
          school_id: number
          updated_at: string
        }
        Insert: {
          class_id: number
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          max_subjects?: number
          min_subjects?: number
          name: string
          school_id: number
          updated_at?: string
        }
        Update: {
          class_id?: number
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          max_subjects?: number
          min_subjects?: number
          name?: string
          school_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category_id: number | null
          code: string
          created_at: string
          description: string
          grade_levels: string
          id: number
          is_active: boolean
          is_core: boolean
          name: string
          school_id: number | null
          updated_at: string
        }
        Insert: {
          category_id?: number | null
          code: string
          created_at?: string
          description?: string
          grade_levels: string
          id?: number
          is_active?: boolean
          is_core: boolean
          name: string
          school_id?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: number | null
          code?: string
          created_at?: string
          description?: string
          grade_levels?: string
          id?: number
          is_active?: boolean
          is_core?: boolean
          name?: string
          school_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "subject_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          end_date: string | null
          id: number
          payment_reference: string | null
          plan_name: string
          school_id: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          end_date?: string | null
          id?: number
          payment_reference?: string | null
          plan_name?: string
          school_id: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          end_date?: string | null
          id?: number
          payment_reference?: string | null
          plan_name?: string
          school_id?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: number
          is_available: boolean | null
          reason: string | null
          school_id: number
          start_time: string
          teacher_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time?: string
          id?: number
          is_available?: boolean | null
          reason?: string | null
          school_id: number
          start_time?: string
          teacher_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: number
          is_available?: boolean | null
          reason?: string | null
          school_id?: number
          start_time?: string
          teacher_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_marks_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          exam_paper_id: number
          id: number
          is_complete: boolean
          marks_entered: number
          teacher_id: number
          total_students: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          exam_paper_id: number
          id?: number
          is_complete?: boolean
          marks_entered?: number
          teacher_id: number
          total_students?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          exam_paper_id?: number
          id?: number
          is_complete?: boolean
          marks_entered?: number
          teacher_id?: number
          total_students?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_marks_progress_exam_paper_id_fkey"
            columns: ["exam_paper_id"]
            isOneToOne: false
            referencedRelation: "exam_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_marks_progress_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_specializations: {
        Row: {
          created_at: string | null
          id: number
          is_primary: boolean | null
          proficiency_level: string | null
          school_id: number
          subject_id: number
          teacher_id: number
          years_experience: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_primary?: boolean | null
          proficiency_level?: string | null
          school_id: number
          subject_id: number
          teacher_id: number
          years_experience?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_primary?: boolean | null
          proficiency_level?: string | null
          school_id?: number
          subject_id?: number
          teacher_id?: number
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_specializations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_specializations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subject_assignments: {
        Row: {
          academic_year: number
          class_assigned_id: number
          created_at: string
          id: number
          is_active: boolean
          is_class_teacher: boolean | null
          stream_id: number | null
          subject_id: number
          teacher_id: number
          term: number | null
          updated_at: string | null
        }
        Insert: {
          academic_year: number
          class_assigned_id: number
          created_at: string
          id?: number
          is_active: boolean
          is_class_teacher?: boolean | null
          stream_id?: number | null
          subject_id: number
          teacher_id: number
          term?: number | null
          updated_at?: string | null
        }
        Update: {
          academic_year?: number
          class_assigned_id?: number
          created_at?: string
          id?: number
          is_active?: boolean
          is_class_teacher?: boolean | null
          stream_id?: number | null
          subject_id?: number
          teacher_id?: number
          term?: number | null
          updated_at?: string | null
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
      teacher_subjects: {
        Row: {
          created_at: string | null
          id: number
          is_primary_subject: boolean | null
          qualification_level: string | null
          subject_id: number
          teacher_id: number
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_primary_subject?: boolean | null
          qualification_level?: string | null
          subject_id: number
          teacher_id: number
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          is_primary_subject?: boolean | null
          qualification_level?: string | null
          subject_id?: number
          teacher_id?: number
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_workload: {
        Row: {
          academic_year: number
          class_id: number
          created_at: string | null
          id: number
          is_class_teacher: boolean | null
          lessons_per_week: number
          school_id: number
          stream_id: number | null
          subject_id: number
          teacher_id: number
          term: number
          updated_at: string | null
        }
        Insert: {
          academic_year?: number
          class_id: number
          created_at?: string | null
          id?: number
          is_class_teacher?: boolean | null
          lessons_per_week?: number
          school_id: number
          stream_id?: number | null
          subject_id: number
          teacher_id: number
          term?: number
          updated_at?: string | null
        }
        Update: {
          academic_year?: number
          class_id?: number
          created_at?: string | null
          id?: number
          is_class_teacher?: boolean | null
          lessons_per_week?: number
          school_id?: number
          stream_id?: number | null
          subject_id?: number
          teacher_id?: number
          term?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_workload_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_workload_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_workload_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_workload_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          account_number: string | null
          address: string | null
          available_days: string[] | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number | null
          created_at: string
          current_workload: number | null
          date_joined: string
          date_of_birth: string
          department: string | null
          designation: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_no: string | null
          employment_type: string | null
          first_name: string | null
          full_name: string | null
          gender: string
          hire_date: string | null
          house_allowance: number | null
          id: number
          is_active: boolean
          is_hod: boolean | null
          job_title: string | null
          kra_pin: string | null
          last_name: string | null
          national_id: string | null
          nhif_number: string | null
          notes: string | null
          nssf_number: string | null
          other_allowances: number | null
          passport_no: string | null
          phone: string
          qualifications: string[] | null
          responsibility_allowance: number | null
          salary_scale: string | null
          school_id: number | null
          staff_category: string | null
          status: string | null
          transport_allowance: number | null
          tsc_number: string
          unavailable_dates: string[] | null
          updated_at: string
          weekly_workload_limit: number | null
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          available_days?: string[] | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          created_at: string
          current_workload?: number | null
          date_joined: string
          date_of_birth: string
          department?: string | null
          designation?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name?: string | null
          gender: string
          hire_date?: string | null
          house_allowance?: number | null
          id?: number
          is_active: boolean
          is_hod?: boolean | null
          job_title?: string | null
          kra_pin?: string | null
          last_name?: string | null
          national_id?: string | null
          nhif_number?: string | null
          notes?: string | null
          nssf_number?: string | null
          other_allowances?: number | null
          passport_no?: string | null
          phone: string
          qualifications?: string[] | null
          responsibility_allowance?: number | null
          salary_scale?: string | null
          school_id?: number | null
          staff_category?: string | null
          status?: string | null
          transport_allowance?: number | null
          tsc_number: string
          unavailable_dates?: string[] | null
          updated_at: string
          weekly_workload_limit?: number | null
        }
        Update: {
          account_number?: string | null
          address?: string | null
          available_days?: string[] | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          created_at?: string
          current_workload?: number | null
          date_joined?: string
          date_of_birth?: string
          department?: string | null
          designation?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_no?: string | null
          employment_type?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string
          hire_date?: string | null
          house_allowance?: number | null
          id?: number
          is_active?: boolean
          is_hod?: boolean | null
          job_title?: string | null
          kra_pin?: string | null
          last_name?: string | null
          national_id?: string | null
          nhif_number?: string | null
          notes?: string | null
          nssf_number?: string | null
          other_allowances?: number | null
          passport_no?: string | null
          phone?: string
          qualifications?: string[] | null
          responsibility_allowance?: number | null
          salary_scale?: string | null
          school_id?: number | null
          staff_category?: string | null
          status?: string | null
          transport_allowance?: number | null
          tsc_number?: string
          unavailable_dates?: string[] | null
          updated_at?: string
          weekly_workload_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_teachers_school"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_school"
            referencedColumns: ["id"]
          },
        ]
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
          auth_user_id: string | null
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
          password: string | null
          phone: string | null
          school_id: number | null
          updated_at: string
          username: string
        }
        Insert: {
          auth_user_id?: string | null
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
          password?: string | null
          phone?: string | null
          school_id?: number | null
          updated_at: string
          username: string
        }
        Update: {
          auth_user_id?: string | null
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
          password?: string | null
          phone?: string | null
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
          {
            foreignKeyName: "users_groups_user_id_f500bee5_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
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
          {
            foreignKeyName: "users_user_permissions_user_id_92473840_fk_users_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_secure"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      attendance_summary: {
        Row: {
          attendance_percentage: number | null
          current_class_id: number | null
          current_stream_id: number | null
          days_absent: number | null
          days_excused: number | null
          days_late: number | null
          days_present: number | null
          full_name: string | null
          student_id: number | null
          total_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_current_class_id_fk_classes"
            columns: ["current_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_stream_id_fk_streams"
            columns: ["current_stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_session_class_progress: {
        Row: {
          class_id: number | null
          class_name: string | null
          completed_papers: number | null
          completion_percentage: number | null
          exam_session_id: number | null
          total_papers: number | null
          total_students: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_session_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_session_classes_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      users_secure: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          date_joined: string | null
          email: string | null
          first_name: string | null
          id: number | null
          is_active: boolean | null
          is_staff: boolean | null
          is_superuser: boolean | null
          last_login: string | null
          last_name: string | null
          phone: string | null
          school_id: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          date_joined?: string | null
          email?: string | null
          first_name?: string | null
          id?: number | null
          is_active?: boolean | null
          is_staff?: boolean | null
          is_superuser?: boolean | null
          last_login?: string | null
          last_name?: string | null
          phone?: string | null
          school_id?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          date_joined?: string | null
          email?: string | null
          first_name?: string | null
          id?: number | null
          is_active?: boolean | null
          is_staff?: boolean | null
          is_superuser?: boolean | null
          last_login?: string | null
          last_name?: string | null
          phone?: string | null
          school_id?: number | null
          updated_at?: string | null
          username?: string | null
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
    }
    Functions: {
      calculate_cbc_grade: {
        Args: { percentage: number }
        Returns: {
          description: string
          grade: string
          points: number
        }[]
      }
      calculate_teacher_workload: {
        Args: { p_teacher_id: number }
        Returns: number
      }
      can_teacher_teach_subject: {
        Args: { p_subject_id: number; p_teacher_id: number }
        Returns: boolean
      }
      check_login_rate_limit: {
        Args: { p_identifier: string }
        Returns: {
          allowed: boolean
          attempts_remaining: number
          retry_after_seconds: number
        }[]
      }
      check_subject_dependencies: {
        Args: { p_subject_id: number }
        Returns: {
          class_count: number
          exam_count: number
          has_dependencies: boolean
          teacher_count: number
        }[]
      }
      check_subscription_status: {
        Args: never
        Returns: {
          days_remaining: number
          is_valid: boolean
          plan: string
          school_name: string
          status: string
        }[]
      }
      clear_orphaned_school_reference: { Args: never; Returns: undefined }
      compute_student_results: {
        Args: { p_exam_session_id: number; p_student_id: number }
        Returns: undefined
      }
      create_school_profile: {
        Args: {
          p_address: string
          p_email: string
          p_logo?: string
          p_motto?: string
          p_name: string
          p_phone: string
          p_type?: string
          p_website?: string
        }
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
      create_student: {
        Args: {
          p_admission_year: number
          p_current_class_id: number
          p_current_stream_id: number
          p_date_of_birth: string
          p_full_name: string
          p_gender: string
          p_guardian_email: string
          p_guardian_name: string
          p_guardian_phone: string
          p_guardian_relationship: string
          p_is_on_transport?: boolean
          p_level: string
          p_photo?: string
        }
        Returns: {
          admission_number: string
          admission_year: number
          created_at: string
          current_class_id: number
          current_stream_id: number
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
          level: string
          photo: string
          school_id: number
          updated_at: string
        }[]
      }
      generate_admission_number: { Args: never; Returns: string }
      generate_employee_number: { Args: never; Returns: string }
      generate_receipt_number: {
        Args: { p_school_id: number }
        Returns: string
      }
      generate_school_code: { Args: never; Returns: string }
      get_all_schools: {
        Args: never
        Returns: {
          active: boolean
          city: string
          code: string
          country: string
          created_at: string
          email: string
          id: number
          name: string
          phone: string
          student_count: number
          subscription_end: string
          subscription_plan: string
          subscription_status: string
          teacher_count: number
        }[]
      }
      get_cbc_grade: {
        Args: { p_marks: number; p_max_marks: number }
        Returns: {
          description: string
          grade: string
          points: number
        }[]
      }
      get_current_user_profile: {
        Args: never
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
        Args: never
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
      get_saas_analytics: {
        Args: never
        Returns: {
          active_schools: number
          inactive_schools: number
          schools_on_enterprise: number
          schools_on_standard: number
          schools_on_starter: number
          total_schools: number
          total_students: number
          total_teachers: number
        }[]
      }
      get_school_users: {
        Args: never
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
      get_subject_stats: {
        Args: { p_subject_id: number }
        Returns: {
          assigned_classes: number
          assigned_teachers: number
          total_exams: number
        }[]
      }
      get_user_school_id: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_module: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: undefined
      }
      lookup_school_by_code: {
        Args: { p_code: string }
        Returns: {
          active: boolean
          code: string
          id: number
          logo: string
          name: string
        }[]
      }
      onboard_new_school: {
        Args: {
          p_address?: string
          p_city?: string
          p_contact_person?: string
          p_contact_phone?: string
          p_country?: string
          p_email: string
          p_name: string
          p_phone?: string
          p_plan?: string
        }
        Returns: {
          school_code: string
          school_id: number
        }[]
      }
      record_login_attempt: {
        Args: { p_identifier: string; p_success: boolean }
        Returns: undefined
      }
      user_can_create_school: { Args: never; Returns: boolean }
      verify_user_school: { Args: { p_school_id: number }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "schooladmin"
        | "finance"
        | "transport"
        | "teacher"
        | "parent"
        | "platform_admin"
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
        "platform_admin",
      ],
    },
  },
} as const
