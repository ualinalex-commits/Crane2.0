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
    };
  };
}
