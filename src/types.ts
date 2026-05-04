/* eslint-disable @typescript-eslint/no-explicit-any */
export enum PlanId {
  FREE = 'free',
  PRO = 'pro',
  BUSINESS = 'business',
  PREMIUM = 'premium',
}

export interface AISettings {
  enable_smart_slots?: boolean;
  enable_gap_prevention?: boolean;
  enable_auto_reengagement?: boolean;
  enable_smart_reminders?: boolean;
  whatsapp_simulation?: boolean;
  automation_level?: 'low' | 'medium' | 'high';
  campaigns?: {
    rescue?: boolean;
    flash_fill?: boolean;
    loyalty?: boolean;
    upsell?: boolean;
  };
}

export interface InstagramPost {
  id: string;
  business_id: string;
  media_url: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  permalink: string;
  caption?: string;
  timestamp: string;
}

export interface InstagramConfig {
  access_token: string;
  user_id: string;
  username?: string;
  expires_at: number; // timestamp
  is_active: boolean;
}

export interface AICampaignResult {
  id: string;
  business_id: string;
  type: 'rescue' | 'flash_fill' | 'loyalty' | 'upsell';
  status: 'pending' | 'sent' | 'responded' | 'converted';
  client_id: string;
  client_name: string;
  message_content: string;
  revenue_impact?: number;
  created_at: any;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan_id?: PlanId;
  subscription_status?: 'active' | 'canceled' | 'trialing' | 'past_due';
  phone?: string;
  email?: string;
  description?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  font_body?: string;
  font_heading?: string;
  border_radius?: string;
  layout_style?: string;
  hero_image_url?: string;
  cover_image_url?: string;
  logo_url?: string;
  custom_css?: string;
  welcome_message?: string;
  footer_text?: string;
  social_instagram?: string;
  social_whatsapp?: string;
  social_facebook?: string;
  hero_title?: string;
  hero_subtitle?: string;
  cta_text?: string;
  show_team_section?: boolean;
  show_services_section?: boolean;
  show_stats_section?: boolean;
  loyalty_currency_name?: string;
  stats_data?: { label: string; value: string }[];
  limit_appointments?: number;
  usage_appointments?: number;
  enable_payment_setup?: boolean;
  payment_methods?: string[];
  payment_timings?: string[];
  pix_key?: string;
  cancel_window_hours?: number;
  reschedule_window_hours?: number;
  whatsapp_api_config?: {
    api_key: string;
    phone_number_id: string;
    is_connected: boolean;
  };
  api_keys?: {
    openai?: string;
    mercadopago?: string;
    stripe?: string;
    firebase?: string;
  };
  instagram_config?: InstagramConfig;
  ai_settings?: AISettings;
  default_working_hours?: {
    day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    start_time: string;
    end_time: string;
    is_active: boolean;
  }[];
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  duration: number;
  duration_minutes?: number; // compat with legacy
  price: number;
  description?: string;
  image_url?: string;
  is_active: boolean;
}

export interface Professional {
  id: string;
  business_id: string;
  name: string;
  specialty?: string;
  avatar_url?: string;
  description?: string;
  is_active: boolean;
}

export interface Unit {
  id: string;
  business_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  image_url?: string;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  business_id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  recurrence_type?: string;
  recurrence_parent_id?: string;
  created_at: any;
  clients?: { name: string; phone?: string };
  professionals?: { name: string };
  services?: { name: string; price?: number; duration_minutes?: number };
}

export interface Client {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  email?: string;
  created_at: any;
}

export interface Review {
  id: string;
  business_id: string;
  client_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  clients?: { name: string };
}

export interface WorkingHour {
  id: string;
  professional_id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  professionals?: { name: string };
}

export interface FixedSlot {
  id: string;
  business_id: string;
  professional_id: string;
  client_name: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  service_id?: string;
  notes?: string;
  professionals?: { name: string };
  services?: { name: string };
}

export interface LoyaltyConfig {
  id: string;
  business_id: string;
  points_per_brl: number;
  min_points_to_redeem: number;
  point_expiration_days: number;
  first_visit_bonus: number;
  referral_bonus: number;
  registration_bonus?: number;
  recurring_visit_bonus?: number;
  is_enabled: boolean;
}

export interface LoyaltyPoints {
  id: string;
  business_id: string;
  client_id: string;
  points: number;
  source: 'appointment' | 'bonus' | 'referral' | 'manual';
  reference_id?: string;
  expires_at?: any;
  created_at: any;
}

export interface LoyaltyReward {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  type: 'discount' | 'free_service' | 'gift' | 'vip';
  points_required: number;
  value?: number;
  is_active: boolean;
  created_at: any;
}

export interface LoyaltyLevel {
  id: string;
  business_id: string;
  name: string;
  min_points: number;
  benefit_description?: string;
  color?: string;
}

export interface LoyaltyMission {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  target: number;
  reward_points: number;
  is_active: boolean;
}

export interface ClientMissionProgress {
  id: string;
  mission_id: string;
  client_id: string;
  business_id: string;
  current_value: number;
  is_completed: boolean;
  completed_at?: any;
}

export interface LoyaltyRedemption {
  id: string;
  business_id: string;
  client_id: string;
  reward_id: string;
  code: string;
  status: 'active' | 'used' | 'expired';
  used_at?: any;
  created_at: any;
}

export interface Notification {
  id: string;
  client_id: string;
  business_id: string;
  title: string;
  body: string;
  type: string;
  status: 'sent' | 'failed' | 'pending';
  channel: 'push' | 'email' | 'whatsapp';
  created_at: any;
}
