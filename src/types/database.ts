export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "learner" | "teacher" | "instructor" | "company_admin" | "super_admin";
export type CompanyMemberRole = "learner" | "teacher" | "instructor" | "company_admin";
export type CourseStatus = "draft" | "published" | "archived";
export type PriceType = "free" | "one_time" | "subscription_only" | "both";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type ContentBlockType = "video" | "text" | "quiz" | "resource" | "image" | "callout" | "tool_spotlight" | "before_after" | "ai_prompt" | "steps" | "checklist" | "key_takeaway" | "expert_note" | "comparison_table" | "case_study" | "meeting" | "practice_exercise";
export type OrderStatus = "pending" | "paid" | "failed" | "refunded";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";
export type MemberStatus = "invited" | "active" | "deactivated";
export type EnrollmentSource = "individual_purchase" | "subscription" | "company_seat" | "gift" | "manual_admin";
export type EnrollmentStatus = "pending_payment" | "active" | "revoked";
export type DiscountType = "percent" | "fixed";
export type ReferralStatus = "pending" | "converted";
export type LiveSessionBookingStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "reschedule_requested"
  | "cancelled_by_learner"
  | "cancelled_by_instructor"
  | "completed"
  | "no_show";
export type AvailabilityExceptionKind = "unavailable" | "extra_available";
export type PracticeSubmissionStatus = "draft" | "submitted" | "scored" | "needs_review" | "reviewed";
export type PracticeReviewStatus = "reviewed" | "resubmission_requested";

type R = [];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          role: UserRole;
          company_id: string | null;
          bio: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          role?: UserRole;
          company_id?: string | null;
          bio?: string | null;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          role?: UserRole;
          company_id?: string | null;
          bio?: string | null;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
        Relationships: R;
      };
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          primary_color: string | null;
          admin_id: string | null;
          is_session_active: boolean;
          active_session_id: string | null;
          active_room_name: string | null;
          home_template: string;
          home_content: Json;
          teacher_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          primary_color?: string | null;
          admin_id?: string | null;
          is_session_active?: boolean;
          active_session_id?: string | null;
          active_room_name?: string | null;
          home_template?: string;
          home_content?: Json;
          teacher_code?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          logo_url?: string | null;
          primary_color?: string | null;
          admin_id?: string | null;
          is_session_active?: boolean;
          active_session_id?: string | null;
          active_room_name?: string | null;
          home_template?: string;
          home_content?: Json;
          teacher_code?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      company_members: {
        Row: {
          id: string;
          company_id: string;
          profile_id: string;
          status: MemberStatus;
          role: CompanyMemberRole;
          invited_at: string;
          joined_at: string | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          profile_id: string;
          status?: MemberStatus;
          role?: CompanyMemberRole;
          joined_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: MemberStatus;
          role?: CompanyMemberRole;
          joined_at?: string | null;
          updated_at?: string;
        };
        Relationships: R;
      };
      courses: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          thumbnail_url: string | null;
          category: string | null;
          level: CourseLevel | null;
          instructor_id: string | null;
          company_id: string | null;
          status: CourseStatus;
          price_type: PriceType;
          price_amount: number | null;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          title: string;
          description?: string | null;
          thumbnail_url?: string | null;
          category?: string | null;
          level?: CourseLevel | null;
          instructor_id?: string | null;
          company_id?: string | null;
          status?: CourseStatus;
          price_type?: PriceType;
          price_amount?: number | null;
          is_featured?: boolean;
        };
        Update: {
          slug?: string;
          title?: string;
          description?: string | null;
          thumbnail_url?: string | null;
          category?: string | null;
          level?: CourseLevel | null;
          company_id?: string | null;
          status?: CourseStatus;
          price_type?: PriceType;
          price_amount?: number | null;
          is_featured?: boolean;
        };
        Relationships: R;
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          position: number;
          created_at: string;
        };
        Insert: { course_id: string; title: string; position: number };
        Update: { title?: string; position?: number };
        Relationships: R;
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          position: number;
          is_preview: boolean;
          created_at: string;
        };
        Insert: {
          module_id: string;
          title: string;
          position: number;
          is_preview?: boolean;
        };
        Update: { title?: string; position?: number; is_preview?: boolean };
        Relationships: R;
      };
      content_blocks: {
        Row: {
          id: string;
          lesson_id: string;
          type: ContentBlockType;
          position: number;
          content: Json;
          created_at: string;
        };
        Insert: {
          lesson_id: string;
          type: ContentBlockType;
          position: number;
          content: Json;
        };
        Update: { type?: ContentBlockType; position?: number; content?: Json };
        Relationships: R;
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          updated_at?: string;
        };
        Relationships: R;
      };
      user_platforms: {
        Row: {
          user_id: string;
          platform: string;
          last_seen_at: string;
        };
        Insert: {
          user_id: string;
          platform: string;
          last_seen_at?: string;
        };
        Update: {
          platform?: string;
          last_seen_at?: string;
        };
        Relationships: R;
      };
      quizzes: {
        Row: {
          id: string;
          lesson_id: string;
          title: string | null;
          pass_threshold: number;
          max_attempts: number;
          created_at: string;
        };
        Insert: {
          lesson_id: string;
          title?: string | null;
          pass_threshold?: number;
          max_attempts?: number;
        };
        Update: { title?: string | null; pass_threshold?: number; max_attempts?: number };
        Relationships: R;
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          question: string;
          options: Json;
          correct_indices: number[];
          explanation: string | null;
          position: number;
        };
        Insert: {
          quiz_id: string;
          question: string;
          options: Json;
          correct_indices: number[];
          explanation?: string | null;
          position: number;
        };
        Update: {
          question?: string;
          options?: Json;
          correct_indices?: number[];
          explanation?: string | null;
          position?: number;
        };
        Relationships: R;
      };
      quiz_attempts: {
        Row: {
          id: string;
          quiz_id: string;
          user_id: string;
          answers: Json;
          score: number;
          passed: boolean;
          created_at: string;
        };
        Insert: {
          quiz_id: string;
          user_id: string;
          answers: Json;
          score: number;
          passed: boolean;
        };
        Update: never;
        Relationships: R;
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          company_id: string | null;
          enrolled_at: string;
          completed_at: string | null;
          source: EnrollmentSource;
          order_id: string | null;
          status: EnrollmentStatus;
          student_phone: string | null;
          notes: string | null;
        };
        Insert: {
          user_id: string;
          course_id: string;
          company_id?: string | null;
          source: EnrollmentSource;
          order_id?: string | null;
          status?: EnrollmentStatus;
          student_phone?: string | null;
          notes?: string | null;
        };
        Update: {
          completed_at?: string | null;
          status?: EnrollmentStatus;
          notes?: string | null;
        };
        Relationships: R;
      };
      lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          completed: boolean;
          completed_at: string | null;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          completed?: boolean;
          completed_at?: string | null;
        };
        Update: { completed?: boolean; completed_at?: string | null };
        Relationships: R;
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          created_at: string;
        };
        Insert: { user_id: string; lesson_id: string };
        Update: never;
        Relationships: R;
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          content: string;
          updated_at: string;
        };
        Insert: { user_id: string; lesson_id: string; content: string };
        Update: { content?: string };
        Relationships: R;
      };
      certificates: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          issued_at: string;
          file_url: string | null;
          public_id: string;
        };
        Insert: {
          user_id: string;
          course_id: string;
          file_url?: string | null;
          public_id: string;
        };
        Update: { file_url?: string | null };
        Relationships: R;
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          company_id: string | null;
          amount: number;
          currency: string;
          status: OrderStatus;
          payment_reference: string | null;
          payment_method: string | null;
          created_at: string;
          paid_at: string | null;
        };
        Insert: {
          user_id: string;
          course_id?: string | null;
          company_id?: string | null;
          amount: number;
          currency?: string;
          status?: OrderStatus;
          payment_reference?: string | null;
          payment_method?: string | null;
        };
        Update: {
          status?: OrderStatus;
          payment_reference?: string | null;
          payment_method?: string | null;
          paid_at?: string | null;
        };
        Relationships: R;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          company_id: string | null;
          plan: string;
          status: SubscriptionStatus;
          seat_count: number;
          current_period_start: string | null;
          current_period_end: string | null;
          processor_sub_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          company_id?: string | null;
          plan: string;
          status?: SubscriptionStatus;
          seat_count?: number;
          current_period_start?: string | null;
          current_period_end?: string | null;
          processor_sub_id?: string | null;
        };
        Update: {
          status?: SubscriptionStatus;
          seat_count?: number;
          current_period_start?: string | null;
          current_period_end?: string | null;
        };
        Relationships: R;
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          course_id: string;
          rating: number;
          comment?: string | null;
        };
        Update: { rating?: number; comment?: string | null };
        Relationships: R;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          read: boolean;
          data: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type?: string;
          title: string;
          body?: string | null;
          read?: boolean;
          data?: Json;
        };
        Update: { read?: boolean };
        Relationships: R;
      };
      discussions: {
        Row: {
          id: string;
          company_id: string | null;
          course_id: string | null;
          lesson_id: string | null;
          user_id: string;
          parent_id: string | null;
          content: string;
          is_public: boolean;
          status: "pending" | "approved" | "flagged" | "hidden";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          course_id?: string | null;
          lesson_id?: string | null;
          user_id: string;
          parent_id?: string | null;
          content: string;
          is_public?: boolean;
          status?: "pending" | "approved" | "flagged" | "hidden";
        };
        Update: {
          content?: string;
          course_id?: string | null;
          is_public?: boolean;
          status?: "pending" | "approved" | "flagged" | "hidden";
        };
        Relationships: R;
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_type: DiscountType;
          discount_value: number;
          max_uses: number | null;
          uses_count: number;
          course_id: string | null;
          expires_at: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          discount_type?: DiscountType;
          discount_value: number;
          max_uses?: number | null;
          course_id?: string | null;
          expires_at?: string | null;
          active?: boolean;
        };
        Update: {
          active?: boolean;
          uses_count?: number;
          max_uses?: number | null;
          expires_at?: string | null;
        };
        Relationships: R;
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string | null;
          referral_code: string;
          course_id: string | null;
          status: ReferralStatus;
          created_at: string;
        };
        Insert: {
          referrer_id: string;
          referred_id?: string | null;
          referral_code: string;
          course_id?: string | null;
          status?: ReferralStatus;
        };
        Update: { referred_id?: string | null; status?: ReferralStatus };
        Relationships: R;
      };
      contact_entries: {
        Row: {
          id: string;
          name: string;
          email: string;
          subject: string | null;
          message: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          subject?: string | null;
          message: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          subject?: string | null;
          message?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: R;
      };
      blog_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string | null;
          name: string | null;
          email: string | null;
          content: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          content: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          content?: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Relationships: R;
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          selected_tool: string;
          inputs: Record<string, Json>;
          output: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          selected_tool: string;
          inputs?: Record<string, Json>;
          output?: string;
          updated_at?: string;
        };
        Update: {
          selected_tool?: string;
          inputs?: Record<string, Json>;
          output?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      live_session_services: {
        Row: {
          id: string;
          instructor_id: string;
          course_id: string | null;
          lesson_id: string | null;
          title: string;
          description: string | null;
          duration_minutes: number;
          buffer_before_minutes: number;
          buffer_after_minutes: number;
          min_notice_hours: number;
          max_booking_days: number;
          requires_instructor_confirmation: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instructor_id: string;
          course_id?: string | null;
          lesson_id?: string | null;
          title: string;
          description?: string | null;
          duration_minutes?: number;
          buffer_before_minutes?: number;
          buffer_after_minutes?: number;
          min_notice_hours?: number;
          max_booking_days?: number;
          requires_instructor_confirmation?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          instructor_id?: string;
          course_id?: string | null;
          lesson_id?: string | null;
          title?: string;
          description?: string | null;
          duration_minutes?: number;
          buffer_before_minutes?: number;
          buffer_after_minutes?: number;
          min_notice_hours?: number;
          max_booking_days?: number;
          requires_instructor_confirmation?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      instructor_availability_rules: {
        Row: {
          id: string;
          instructor_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          timezone: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          instructor_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          instructor_id?: string;
          weekday?: number;
          start_time?: string;
          end_time?: string;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      instructor_availability_exceptions: {
        Row: {
          id: string;
          instructor_id: string;
          date: string;
          timezone: string;
          start_time: string | null;
          end_time: string | null;
          kind: AvailabilityExceptionKind;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          instructor_id: string;
          date: string;
          timezone?: string;
          start_time?: string | null;
          end_time?: string | null;
          kind: AvailabilityExceptionKind;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          instructor_id?: string;
          date?: string;
          timezone?: string;
          start_time?: string | null;
          end_time?: string | null;
          kind?: AvailabilityExceptionKind;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: R;
      };
      live_session_bookings: {
        Row: {
          id: string;
          service_id: string;
          course_id: string | null;
          lesson_id: string | null;
          instructor_id: string;
          learner_id: string;
          status: LiveSessionBookingStatus;
          starts_at: string;
          ends_at: string;
          timezone: string;
          learner_notes: string | null;
          instructor_notes: string | null;
          meeting_agenda: Json;
          confirmed_at: string | null;
          declined_at: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          course_id?: string | null;
          lesson_id?: string | null;
          instructor_id: string;
          learner_id: string;
          status?: LiveSessionBookingStatus;
          starts_at: string;
          ends_at: string;
          timezone?: string;
          learner_notes?: string | null;
          instructor_notes?: string | null;
          meeting_agenda?: Json;
          confirmed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          service_id?: string;
          course_id?: string | null;
          lesson_id?: string | null;
          instructor_id?: string;
          learner_id?: string;
          status?: LiveSessionBookingStatus;
          starts_at?: string;
          ends_at?: string;
          timezone?: string;
          learner_notes?: string | null;
          instructor_notes?: string | null;
          meeting_agenda?: Json;
          confirmed_at?: string | null;
          declined_at?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      zoom_meetings: {
        Row: {
          id: string;
          booking_id: string;
          zoom_meeting_id: string;
          zoom_uuid: string | null;
          host_id: string | null;
          host_email: string | null;
          topic: string;
          start_url_encrypted: string | null;
          join_url: string | null;
          password_encrypted: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          zoom_meeting_id: string;
          zoom_uuid?: string | null;
          host_id?: string | null;
          host_email?: string | null;
          topic: string;
          start_url_encrypted?: string | null;
          join_url?: string | null;
          password_encrypted?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          zoom_meeting_id?: string;
          zoom_uuid?: string | null;
          host_id?: string | null;
          host_email?: string | null;
          topic?: string;
          start_url_encrypted?: string | null;
          join_url?: string | null;
          password_encrypted?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      live_session_events: {
        Row: {
          id: string;
          booking_id: string;
          actor_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          actor_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: R;
      };
      live_session_attendance: {
        Row: {
          id: string;
          booking_id: string;
          user_id: string;
          role: "learner" | "instructor" | "admin";
          joined_at: string;
          left_at: string | null;
          duration_seconds: number | null;
          client_metadata: Json;
        };
        Insert: {
          id?: string;
          booking_id: string;
          user_id: string;
          role: "learner" | "instructor" | "admin";
          joined_at?: string;
          left_at?: string | null;
          duration_seconds?: number | null;
          client_metadata?: Json;
        };
        Update: {
          left_at?: string | null;
          duration_seconds?: number | null;
          client_metadata?: Json;
        };
        Relationships: R;
      };
      practice_exercise_submissions: {
        Row: {
          id: string;
          exercise_block_id: string;
          course_id: string;
          lesson_id: string;
          user_id: string;
          status: PracticeSubmissionStatus;
          attempt_number: number;
          text_response: string | null;
          studio_tool_id: string | null;
          studio_inputs: Json;
          studio_output: string | null;
          metadata: Json;
          submitted_at: string | null;
          scored_at: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exercise_block_id: string;
          course_id: string;
          lesson_id: string;
          user_id: string;
          status?: PracticeSubmissionStatus;
          attempt_number?: number;
          text_response?: string | null;
          studio_tool_id?: string | null;
          studio_inputs?: Json;
          studio_output?: string | null;
          metadata?: Json;
          submitted_at?: string | null;
          scored_at?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: PracticeSubmissionStatus;
          attempt_number?: number;
          text_response?: string | null;
          studio_tool_id?: string | null;
          studio_inputs?: Json;
          studio_output?: string | null;
          metadata?: Json;
          submitted_at?: string | null;
          scored_at?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      practice_exercise_files: {
        Row: {
          id: string;
          submission_id: string;
          user_id: string;
          bucket_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          user_id: string;
          bucket_id?: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size: number;
          created_at?: string;
        };
        Update: {
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size?: number;
        };
        Relationships: R;
      };
      practice_exercise_scores: {
        Row: {
          id: string;
          submission_id: string;
          score: number;
          max_score: number;
          rubric_breakdown: Json;
          feedback_summary: string | null;
          strengths: Json;
          improvements: Json;
          model: string | null;
          confidence: number | null;
          needs_instructor_review: boolean;
          raw_ai_response: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          score: number;
          max_score?: number;
          rubric_breakdown?: Json;
          feedback_summary?: string | null;
          strengths?: Json;
          improvements?: Json;
          model?: string | null;
          confidence?: number | null;
          needs_instructor_review?: boolean;
          raw_ai_response?: Json;
          created_at?: string;
        };
        Update: {
          score?: number;
          max_score?: number;
          rubric_breakdown?: Json;
          feedback_summary?: string | null;
          strengths?: Json;
          improvements?: Json;
          model?: string | null;
          confidence?: number | null;
          needs_instructor_review?: boolean;
          raw_ai_response?: Json;
        };
        Relationships: R;
      };
      practice_exercise_reviews: {
        Row: {
          id: string;
          submission_id: string;
          reviewer_id: string;
          score_override: number | null;
          feedback: string | null;
          status: PracticeReviewStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          reviewer_id: string;
          score_override?: number | null;
          feedback?: string | null;
          status?: PracticeReviewStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          score_override?: number | null;
          feedback?: string | null;
          status?: PracticeReviewStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      media_assets: {
        Row: {
          id: string;
          bucket: string;
          path: string;
          public_url: string;
          file_name: string;
          original_name: string;
          alt_text: string | null;
          caption: string | null;
          mime_type: string;
          size_bytes: number;
          width: number | null;
          height: number | null;
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bucket?: string;
          path: string;
          public_url: string;
          file_name: string;
          original_name: string;
          alt_text?: string | null;
          caption?: string | null;
          mime_type: string;
          size_bytes: number;
          width?: number | null;
          height?: number | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          bucket?: string;
          path?: string;
          public_url?: string;
          file_name?: string;
          original_name?: string;
          alt_text?: string | null;
          caption?: string | null;
          mime_type?: string;
          size_bytes?: number;
          width?: number | null;
          height?: number | null;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      page_media_slots: {
        Row: {
          id: string;
          page_key: string;
          slot_key: string;
          label: string;
          description: string | null;
          image_url: string | null;
          media_asset_id: string | null;
          alt_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          page_key: string;
          slot_key: string;
          label: string;
          description?: string | null;
          image_url?: string | null;
          media_asset_id?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          page_key?: string;
          slot_key?: string;
          label?: string;
          description?: string | null;
          image_url?: string | null;
          media_asset_id?: string | null;
          alt_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      blog_posts: {
        Row: {
          id: string;
          slug: string;
          title: string;
          excerpt: string;
          category: string;
          author_name: string;
          read_time: string;
          tags: Json;
          content: Json;
          card_image_url: string | null;
          card_media_asset_id: string | null;
          hero_image_url: string | null;
          hero_media_asset_id: string | null;
          status: string;
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          excerpt: string;
          category: string;
          author_name?: string;
          read_time: string;
          tags?: Json;
          content?: Json;
          card_image_url?: string | null;
          card_media_asset_id?: string | null;
          hero_image_url?: string | null;
          hero_media_asset_id?: string | null;
          status?: string;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          title?: string;
          excerpt?: string;
          category?: string;
          author_name?: string;
          read_time?: string;
          tags?: Json;
          content?: Json;
          card_image_url?: string | null;
          card_media_asset_id?: string | null;
          hero_image_url?: string | null;
          hero_media_asset_id?: string | null;
          status?: string;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      site_assets: {
        Row: {
          id: string;
          key: string;
          url: string;
          description: string | null;
          page: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          url: string;
          description?: string | null;
          page?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          url?: string;
          description?: string | null;
          page?: string;
          updated_at?: string;
        };
        Relationships: R;
      };
      announcements: {
        Row: {
          id: string;
          company_id: string;
          author_id: string;
          title: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          author_id: string;
          title: string;
          content: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
        };
        Relationships: R;
      };
      class_schedules: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          instructor_id: string | null;
          schedule_type: "live_session" | "workshop" | "assignment_due" | "other";
          day_of_week: number | null;
          start_time_only: string | null;
          end_time_only: string | null;
          topics_covered: string | null;
          is_recurring: boolean;
          group_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          description?: string | null;
          starts_at: string;
          ends_at: string;
          instructor_id?: string | null;
          schedule_type?: "live_session" | "workshop" | "assignment_due" | "other";
          day_of_week?: number | null;
          start_time_only?: string | null;
          end_time_only?: string | null;
          topics_covered?: string | null;
          is_recurring?: boolean;
          group_id?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          starts_at?: string;
          ends_at?: string;
          instructor_id?: string | null;
          schedule_type?: "live_session" | "workshop" | "assignment_due" | "other";
          day_of_week?: number | null;
          start_time_only?: string | null;
          end_time_only?: string | null;
          topics_covered?: string | null;
          is_recurring?: boolean;
          group_id?: string | null;
        };
        Relationships: R;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Module = Database["public"]["Tables"]["modules"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
export type ContentBlock = Database["public"]["Tables"]["content_blocks"]["Row"];
export type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
export type LessonProgress = Database["public"]["Tables"]["lesson_progress"]["Row"];
export type MediaAsset = Database["public"]["Tables"]["media_assets"]["Row"];
export type PageMediaSlot = Database["public"]["Tables"]["page_media_slots"]["Row"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
export type LiveSessionService = Database["public"]["Tables"]["live_session_services"]["Row"];
export type InstructorAvailabilityRule = Database["public"]["Tables"]["instructor_availability_rules"]["Row"];
export type InstructorAvailabilityException = Database["public"]["Tables"]["instructor_availability_exceptions"]["Row"];
export type LiveSessionBooking = Database["public"]["Tables"]["live_session_bookings"]["Row"];
export type ZoomMeeting = Database["public"]["Tables"]["zoom_meetings"]["Row"];
export type LiveSessionEvent = Database["public"]["Tables"]["live_session_events"]["Row"];
export type LiveSessionAttendance = Database["public"]["Tables"]["live_session_attendance"]["Row"];
export type PracticeExerciseSubmission = Database["public"]["Tables"]["practice_exercise_submissions"]["Row"];
export type PracticeExerciseFile = Database["public"]["Tables"]["practice_exercise_files"]["Row"];
export type PracticeExerciseScore = Database["public"]["Tables"]["practice_exercise_scores"]["Row"];
export type PracticeExerciseReview = Database["public"]["Tables"]["practice_exercise_reviews"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Certificate = Database["public"]["Tables"]["certificates"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Discussion = Database["public"]["Tables"]["discussions"]["Row"];
export type Coupon = Database["public"]["Tables"]["coupons"]["Row"];
export type Referral = Database["public"]["Tables"]["referrals"]["Row"];
export type SiteAsset = Database["public"]["Tables"]["site_assets"]["Row"];
