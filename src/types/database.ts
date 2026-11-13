
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "chapters": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"module_id": string,"position": number,"slug": string,"status": Database["public"]['Enums']["publication_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"module_id": string,"position"?: number,"slug": string,"status"?: Database["public"]['Enums']["publication_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"module_id"?: string,"position"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["publication_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapters_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "cover_image_url": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"position": number,"slug": string,"status": Database["public"]['Enums']["publication_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_image_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"position"?: number,"slug": string,"status"?: Database["public"]['Enums']["publication_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "cover_image_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"position"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["publication_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "chapter_id": string,"content": string | null,"course_id": string,"created_at": string,"duration_minutes": number | null,"id": string,"is_free_preview": boolean,"position": number,"published_at": string | null,"slug": string,"status": Database["public"]['Enums']["publication_status"],"summary": string | null,"title": string,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_id": string,"content"?: string | null,"course_id": string,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"is_free_preview"?: boolean,"position"?: number,"published_at"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["publication_status"],"summary"?: string | null,"title": string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "chapter_id"?: string,"content"?: string | null,"course_id"?: string,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"is_free_preview"?: boolean,"position"?: number,"published_at"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["publication_status"],"summary"?: string | null,"title"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"manuals": {
                  Row: {
                    "course_id": string,"created_at": string,"created_by": string | null,"description": string | null,"file_size_bytes": number | null,"id": string,"page_count": number | null,"pdf_url": string,"position": number,"published_at": string | null,"status": Database["public"]['Enums']["publication_status"],"subject_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"file_size_bytes"?: number | null,"id"?: string,"page_count"?: number | null,"pdf_url": string,"position"?: number,"published_at"?: string | null,"status"?: Database["public"]['Enums']["publication_status"],"subject_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"file_size_bytes"?: number | null,"id"?: string,"page_count"?: number | null,"pdf_url"?: string,"position"?: number,"published_at"?: string | null,"status"?: Database["public"]['Enums']["publication_status"],"subject_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "manuals_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "manuals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "manuals_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"position": number,"slug": string,"status": Database["public"]['Enums']["publication_status"],"subject_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"slug": string,"status"?: Database["public"]['Enums']["publication_status"],"subject_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["publication_status"],"subject_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modules_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_mzn": number,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"notes": string | null,"paid_at": string | null,"plan_id": string | null,"recorded_by": string | null,"reference": string | null,"status": Database["public"]['Enums']["payment_status"],"subscription_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_mzn": number,"created_at"?: string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"notes"?: string | null,"paid_at"?: string | null,"plan_id"?: string | null,"recorded_by"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"subscription_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_mzn"?: number,"created_at"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"paid_at"?: string | null,"plan_id"?: string | null,"recorded_by"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"subscription_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "academic_year": number | null,"avatar_url": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"institution": string | null,"phone": string | null,"province": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year"?: number | null,"avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id": string,"institution"?: string | null,"phone"?: string | null,"province"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "academic_year"?: number | null,"avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"institution"?: string | null,"phone"?: string | null,"province"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"questions": {
                  Row: {
                    "correct_option": string,"created_at": string,"explanation": string | null,"id": string,"option_a": string,"option_b": string,"option_c": string,"option_d": string,"points": number,"position": number,"quiz_id": string,"statement": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct_option": string,"created_at"?: string,"explanation"?: string | null,"id"?: string,"option_a": string,"option_b": string,"option_c": string,"option_d": string,"points"?: number,"position"?: number,"quiz_id": string,"statement": string,"updated_at"?: string
                  }
                  Update: {
                    "correct_option"?: string,"created_at"?: string,"explanation"?: string | null,"id"?: string,"option_a"?: string,"option_b"?: string,"option_c"?: string,"option_d"?: string,"points"?: number,"position"?: number,"quiz_id"?: string,"statement"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_attempts": {
                  Row: {
                    "answers": NonNullable<Json>,"created_at": string,"expires_at": string | null,"id": string,"max_score": number,"passed": boolean,"percentage": number,"quiz_id": string,"score": number,"started_at": string,"status": Database["public"]['Enums']["quiz_attempt_status"],"submitted_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"max_score"?: number,"passed"?: boolean,"percentage"?: number,"quiz_id": string,"score"?: number,"started_at"?: string,"status"?: Database["public"]['Enums']["quiz_attempt_status"],"submitted_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"max_score"?: number,"passed"?: boolean,"percentage"?: number,"quiz_id"?: string,"score"?: number,"started_at"?: string,"status"?: Database["public"]['Enums']["quiz_attempt_status"],"submitted_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempts_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "chapter_id": string | null,"course_id": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"lesson_id": string | null,"max_attempts": number | null,"module_id": string | null,"passing_score": number,"position": number,"shuffle_questions": boolean,"status": Database["public"]['Enums']["publication_status"],"subject_id": string | null,"time_limit_minutes": number | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chapter_id"?: string | null,"course_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"lesson_id"?: string | null,"max_attempts"?: number | null,"module_id"?: string | null,"passing_score"?: number,"position"?: number,"shuffle_questions"?: boolean,"status"?: Database["public"]['Enums']["publication_status"],"subject_id"?: string | null,"time_limit_minutes"?: number | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "chapter_id"?: string | null,"course_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"lesson_id"?: string | null,"max_attempts"?: number | null,"module_id"?: string | null,"passing_score"?: number,"position"?: number,"shuffle_questions"?: boolean,"status"?: Database["public"]['Enums']["publication_status"],"subject_id"?: string | null,"time_limit_minutes"?: number | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quizzes_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quizzes_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quizzes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quizzes_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quizzes_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quizzes_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"resources": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"lesson_id": string,"position": number,"title": string,"type": Database["public"]['Enums']["resource_type"],"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"lesson_id": string,"position"?: number,"title": string,"type"?: Database["public"]['Enums']["resource_type"],"updated_at"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"lesson_id"?: string,"position"?: number,"title"?: string,"type"?: Database["public"]['Enums']["resource_type"],"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resources_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"student_progress": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"last_viewed_at": string,"lesson_id": string,"status": Database["public"]['Enums']["progress_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"last_viewed_at"?: string,"lesson_id": string,"status"?: Database["public"]['Enums']["progress_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"last_viewed_at"?: string,"lesson_id"?: string,"status"?: Database["public"]['Enums']["progress_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "course_id": string,"created_at": string,"description": string | null,"id": string,"position": number,"slug": string,"status": Database["public"]['Enums']["publication_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"slug": string,"status"?: Database["public"]['Enums']["publication_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["publication_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subjects_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"subscription_plans": {
                  Row: {
                    "course_id": string | null,"created_at": string,"description": string | null,"duration_days": number,"features": (string)[],"id": string,"is_active": boolean,"name": string,"position": number,"price_mzn": number,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"description"?: string | null,"duration_days"?: number,"features"?: (string)[],"id"?: string,"is_active"?: boolean,"name": string,"position"?: number,"price_mzn": number,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"description"?: string | null,"duration_days"?: number,"features"?: (string)[],"id"?: string,"is_active"?: boolean,"name"?: string,"position"?: number,"price_mzn"?: number,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_plans_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "activated_by": string | null,"created_at": string,"expires_at": string | null,"id": string,"notes": string | null,"plan_id": string,"starts_at": string | null,"status": Database["public"]['Enums']["subscription_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_by"?: string | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"notes"?: string | null,"plan_id": string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "activated_by"?: string | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"notes"?: string | null,"plan_id"?: string,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["subscription_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_activated_by_fkey"
      columns: ["activated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "subscription_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_grade_attempt":
{ Args: { "p_answers": Json,"p_attempt_id": string,"p_status": Database["public"]['Enums']["quiz_attempt_status"] }; Returns: {
              "answers": NonNullable<Json>,
"created_at": string,
"expires_at": string | null,
"id": string,
"max_score": number,
"passed": boolean,
"percentage": number,
"quiz_id": string,
"score": number,
"started_at": string,
"status": Database["public"]['Enums']["quiz_attempt_status"],
"submitted_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "quiz_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"can_access_lesson":
{ Args: { "p_lesson_id": string }; Returns: boolean
                           },
"expire_subscriptions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"get_attempt_questions":
{ Args: { "p_attempt_id": string }; Returns: {
              "id": string,"option_a": string,"option_b": string,"option_c": string,"option_d": string,"points": number,"position": number,"statement": string
            }[]
                           },
"get_attempt_review":
{ Args: { "p_attempt_id": string }; Returns: {
              "correct_option": string,"explanation": string,"is_correct": boolean,"option_a": string,"option_b": string,"option_c": string,"option_d": string,"points": number,"question_id": string,"selected_option": string,"statement": string
            }[]
                           },
"get_manual_pdf_url":
{ Args: { "p_manual_id": string }; Returns: string
                           },
"has_active_subscription":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"has_course_access":
{ Args: { "p_course_id": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_lesson_published":
{ Args: { "p_lesson_id": string }; Returns: boolean
                           },
"lesson_outline":
{ Args: { "p_chapter_id": string }; Returns: {
              "duration_minutes": number,"id": string,"is_free_preview": boolean,"is_locked": boolean,"position": number,"slug": string,"summary": string,"title": string
            }[]
                           },
"set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user_id": string }; Returns: undefined
                           },
"start_quiz_attempt":
{ Args: { "p_quiz_id": string }; Returns: {
              "answers": NonNullable<Json>,
"created_at": string,
"expires_at": string | null,
"id": string,
"max_score": number,
"passed": boolean,
"percentage": number,
"quiz_id": string,
"score": number,
"started_at": string,
"status": Database["public"]['Enums']["quiz_attempt_status"],
"submitted_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "quiz_attempts"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_quiz_attempt":
{ Args: { "p_answers": Json,"p_attempt_id": string }; Returns: {
              "answers": NonNullable<Json>,
"created_at": string,
"expires_at": string | null,
"id": string,
"max_score": number,
"passed": boolean,
"percentage": number,
"quiz_id": string,
"score": number,
"started_at": string,
"status": Database["public"]['Enums']["quiz_attempt_status"],
"submitted_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "quiz_attempts"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "payment_method": "mpesa"|"emola"|"mkesh"|"bank_transfer"|"cash"|"other","payment_status": "pending"|"confirmed"|"rejected","progress_status": "not_started"|"in_progress"|"completed","publication_status": "draft"|"published"|"archived","quiz_attempt_status": "in_progress"|"submitted"|"expired","resource_type": "pdf"|"video"|"link"|"document"|"image"|"other","subscription_status": "pending"|"active"|"expired"|"suspended","user_role": "student"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "payment_method": ["mpesa", "emola", "mkesh", "bank_transfer", "cash", "other"],"payment_status": ["pending", "confirmed", "rejected"],"progress_status": ["not_started", "in_progress", "completed"],"publication_status": ["draft", "published", "archived"],"quiz_attempt_status": ["in_progress", "submitted", "expired"],"resource_type": ["pdf", "video", "link", "document", "image", "other"],"subscription_status": ["pending", "active", "expired", "suspended"],"user_role": ["student", "admin"]
          }
        }
} as const
