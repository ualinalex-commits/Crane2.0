export type UserRole =
  | 'admin'
  | 'company_admin'
  | 'appointed_person'
  | 'crane_supervisor'
  | 'crane_operator'
  | 'slinger_signaller'
  | 'subcontractor';

export type CraneStatus =
  | 'Working'
  | 'Service'
  | 'Thorough Examination'
  | 'Breaking Down'
  | 'Winded Off'
  | 'Idle';

export type BookingStatus = 'pending' | 'approved' | 'cancelled';

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address: string;
  created_at: string;
  company?: Company;
}

export interface Crane {
  id: string;
  site_id: string;
  name: string;
  model: string;
  capacity: string;
  created_at: string;
  site?: Site;
}

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  site_id: string | null;
  subcontractor_company_name: string | null;
  created_at: string;
  company?: Company;
  site?: Site;
}

export interface Subcontractor {
  id: string;
  site_id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  created_at: string;
}

export interface CraneLog {
  id: string;
  crane_id: string;
  site_id: string;
  created_by: string;
  status: CraneStatus;
  job_details: string;
  subcontractor_id: string | null;
  start_time: string;
  end_time: string | null;
  is_open: boolean;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  crane?: Crane;
  subcontractor?: Subcontractor;
  creator?: Profile;
  closer?: Profile;
  images?: CraneLogImage[];
}

export interface CraneLogImage {
  id: string;
  log_id: string;
  image_url: string;
  created_at: string;
}

export interface CraneBooking {
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
  status: BookingStatus;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  crane?: Crane;
  subcontractor?: Subcontractor;
  creator?: Profile;
}

export interface CancellationLog {
  id: string;
  booking_id: string;
  crane_id: string;
  booking_details: Record<string, unknown>;
  cancelled_by: string;
  cancelled_at: string;
  canceller?: Profile;
  crane?: Crane;
}
