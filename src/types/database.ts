export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      sites: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          address: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          address?: string;
          created_at?: string;
        };
      };
      cranes: {
        Row: {
          id: string;
          site_id: string;
          name: string;
          model: string;
          capacity: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          name: string;
          model: string;
          capacity: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          name?: string;
          model?: string;
          capacity?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string;
          role: string;
          company_id: string | null;
          site_id: string | null;
          subcontractor_company_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name: string;
          role: string;
          company_id?: string | null;
          site_id?: string | null;
          subcontractor_company_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          full_name?: string;
          role?: string;
          company_id?: string | null;
          site_id?: string | null;
          subcontractor_company_name?: string | null;
          created_at?: string;
        };
      };
      subcontractors: {
        Row: {
          id: string;
          site_id: string;
          company_name: string;
          contact_name: string;
          contact_email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          company_name: string;
          contact_name: string;
          contact_email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          company_name?: string;
          contact_name?: string;
          contact_email?: string;
          created_at?: string;
        };
      };
      crane_logs: {
        Row: {
          id: string;
          crane_id: string;
          site_id: string;
          created_by: string;
          status: string;
          job_details: string;
          subcontractor_id: string | null;
          start_time: string;
          end_time: string | null;
          is_open: boolean;
          closed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crane_id: string;
          site_id: string;
          created_by: string;
          status: string;
          job_details: string;
          subcontractor_id?: string | null;
          start_time?: string;
          end_time?: string | null;
          is_open?: boolean;
          closed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          crane_id?: string;
          site_id?: string;
          created_by?: string;
          status?: string;
          job_details?: string;
          subcontractor_id?: string | null;
          start_time?: string;
          end_time?: string | null;
          is_open?: boolean;
          closed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      crane_log_images: {
        Row: {
          id: string;
          log_id: string;
          image_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          log_id: string;
          image_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          log_id?: string;
          image_url?: string;
          created_at?: string;
        };
      };
      crane_bookings: {
        Row: {
          id: string;
          crane_id: string;
          site_id: string;
          subcontractor_id: string | null;
          created_by: string;
          job_details: string;
          job_date_start: string;
          job_date_end: string;
          start_time: string;
          end_time: string;
          status: string;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          crane_id: string;
          site_id: string;
          subcontractor_id?: string | null;
          created_by: string;
          job_details: string;
          job_date_start: string;
          job_date_end: string;
          start_time: string;
          end_time: string;
          status?: string;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          crane_id?: string;
          site_id?: string;
          subcontractor_id?: string | null;
          created_by?: string;
          job_details?: string;
          job_date_start?: string;
          job_date_end?: string;
          start_time?: string;
          end_time?: string;
          status?: string;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cancellation_log: {
        Row: {
          id: string;
          booking_id: string;
          crane_id: string;
          booking_details: Record<string, unknown>;
          cancelled_by: string;
          cancelled_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          crane_id: string;
          booking_details: Record<string, unknown>;
          cancelled_by: string;
          cancelled_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          crane_id?: string;
          booking_details?: Record<string, unknown>;
          cancelled_by?: string;
          cancelled_at?: string;
        };
      };
      daily_briefings: {
        Row: {
          id: string;
          site_id: string;
          date: string;
          created_by: string;
          attendees: any;
          wind_speed: string | null;
          gust_speed: string | null;
          weather_conditions: string | null;
          weather_last_updated: string | null;
          first_aider_name: string | null;
          site_location: string | null;
          muster_point_location: string | null;
          site_changes: string | null;
          any_other_business: string | null;
          lifting_schedule: string | null;
          images: string[] | null;
          checklist_crane_responsible: boolean | null;
          checklist_activities_planned: boolean | null;
          checklist_deliveries_scheduled: boolean | null;
          checklist_environmental_changes: boolean | null;
          checklist_pre_use_checks: boolean | null;
          checklist_safety_first: boolean | null;
          checklist_crane_secured: boolean | null;
          checklist_whistles_checked: boolean | null;
          checklist_radio_check: boolean | null;
          appointed_person_name: string | null;
          lifting_supervisor_name: string | null;
          supervisor_signature_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          date?: string;
          created_by: string;
          attendees?: any;
          wind_speed?: string | null;
          gust_speed?: string | null;
          weather_conditions?: string | null;
          weather_last_updated?: string | null;
          first_aider_name?: string | null;
          site_location?: string | null;
          muster_point_location?: string | null;
          site_changes?: string | null;
          any_other_business?: string | null;
          lifting_schedule?: string | null;
          images?: string[] | null;
          checklist_crane_responsible?: boolean | null;
          checklist_activities_planned?: boolean | null;
          checklist_deliveries_scheduled?: boolean | null;
          checklist_environmental_changes?: boolean | null;
          checklist_pre_use_checks?: boolean | null;
          checklist_safety_first?: boolean | null;
          checklist_crane_secured?: boolean | null;
          checklist_whistles_checked?: boolean | null;
          checklist_radio_check?: boolean | null;
          appointed_person_name?: string | null;
          lifting_supervisor_name?: string | null;
          supervisor_signature_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          date?: string;
          created_by?: string;
          attendees?: any;
          wind_speed?: string | null;
          gust_speed?: string | null;
          weather_conditions?: string | null;
          weather_last_updated?: string | null;
          first_aider_name?: string | null;
          site_location?: string | null;
          muster_point_location?: string | null;
          site_changes?: string | null;
          any_other_business?: string | null;
          lifting_schedule?: string | null;
          images?: string[] | null;
          checklist_crane_responsible?: boolean | null;
          checklist_activities_planned?: boolean | null;
          checklist_deliveries_scheduled?: boolean | null;
          checklist_environmental_changes?: boolean | null;
          checklist_pre_use_checks?: boolean | null;
          checklist_safety_first?: boolean | null;
          checklist_crane_secured?: boolean | null;
          checklist_whistles_checked?: boolean | null;
          checklist_radio_check?: boolean | null;
          appointed_person_name?: string | null;
          lifting_supervisor_name?: string | null;
          supervisor_signature_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      briefing_signatures: {
        Row: {
          id: string;
          briefing_id: string;
          user_id: string;
          name: string;
          company: string;
          role: string;
          signature_image_url: string;
          signed_at: string;
        };
        Insert: {
          id?: string;
          briefing_id: string;
          user_id: string;
          name: string;
          company: string;
          role: string;
          signature_image_url: string;
          signed_at?: string;
        };
        Update: {
          id?: string;
          briefing_id?: string;
          user_id?: string;
          name?: string;
          company?: string;
          role?: string;
          signature_image_url?: string;
          signed_at?: string;
        };
      };
    };
  };
}
