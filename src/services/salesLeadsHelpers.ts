/**
 * Sales Leads Helpers Service
 * Contains utility functions for working with sales leads, including status helpers,
 * progress calculations, and summary computations
 */

import {
  Plus,
  Phone,
  Calendar,
  CheckCircle,
  TrendingUp,
  Clock,
  Trophy,
  AlertCircle,
} from "lucide-react";

export interface SalesLead {
  id: string;
  institution_name: string;
  instructor_id: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  status: string | null;
  potential_value: number | null;
  commission_percentage: number | null;
  notes: string | null;
  created_at: string | null;
  closed_at: string | null;
  instructor?: {
    id: string;
    full_name: string;
    phone: string | null;
  };
}

export interface MonthlySummary {
  teaching_incentives: number;
  closing_bonuses: number;
  team_rewards: number;
  total: number;
}

/**
 * Gets the appropriate icon component for a given sales lead status
 * @param status - The sales lead status
 * @returns React icon component
 */
export function getStatusIcon(status: string | null) {
  if (!status) return AlertCircle;

  switch (status) {
    case 'new':
      return Plus;
    case 'contacted':
      return Phone;
    case 'meeting_scheduled':
      return Calendar;
    case 'proposal_sent':
      return CheckCircle;
    case 'negotiation':
      return TrendingUp;
    case 'follow_up':
      return Clock;
    case 'closed_won':
      return Trophy;
    case 'closed_lost':
      return AlertCircle;
    default:
      return AlertCircle;
  }
}

/**
 * Gets the Hebrew label for a given sales lead status
 * @param status - The sales lead status
 * @returns Hebrew status label
 */
export function getStatusLabel(status: string | null): string {
  if (!status) return 'ללא סטטוס';

  switch (status) {
    case 'new':
      return 'חדש';
    case 'contacted':
      return 'נוצר קשר';
    case 'meeting_scheduled':
      return 'נקבעה פגישה';
    case 'proposal_sent':
      return 'נשלחה הצעה';
    case 'negotiation':
      return 'במשא ומתן';
    case 'follow_up':
      return 'מעקב';
    case 'closed_won':
      return 'נסגר - זכייה';
    case 'closed_lost':
      return 'נסגר - הפסד';
    default:
      return status;
  }
}

/**
 * Gets the appropriate color classes for a given sales lead status
 * @param status - The sales lead status
 * @returns Tailwind CSS classes for background, text, and border colors
 */
export function getStatusColor(status: string | null): string {
  if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';

  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'contacted':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'meeting_scheduled':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'proposal_sent':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'negotiation':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'follow_up':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'closed_won':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'closed_lost':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Calculates the progress percentage based on sales lead status
 * @param status - The sales lead status
 * @returns Progress percentage (0-100)
 */
export function getProgressFromStatus(status: string | null): number {
  if (!status) return 0;

  switch (status) {
    case 'new':
      return 10;
    case 'contacted':
      return 25;
    case 'meeting_scheduled':
      return 50;
    case 'proposal_sent':
      return 75;
    case 'negotiation':
      return 85;
    case 'follow_up':
      return 60;
    case 'closed_won':
      return 100;
    case 'closed_lost':
      return 0;
    default:
      return 0;
  }
}

/**
 * Calculates monthly summary from an array of sales leads
 * @param leads - Array of sales leads
 * @returns Monthly summary with breakdown of different reward types
 */
export function calculateMonthlySummary(leads: SalesLead[]): MonthlySummary {
  const totalPotentialValue = leads.reduce((sum, lead) => {
    return sum + (lead.potential_value || 0);
  }, 0);

  // Calculate different reward types based on potential values
  // Adjust these percentages as needed
  const teaching_incentives = Math.floor(totalPotentialValue * 0.4); // 40% for teaching incentives
  const closing_bonuses = Math.floor(totalPotentialValue * 0.3); // 30% for closing bonuses
  const team_rewards = Math.floor(totalPotentialValue * 0.1); // 10% for team rewards
  const total = totalPotentialValue;

  return {
    teaching_incentives,
    closing_bonuses,
    team_rewards,
    total
  };
}
