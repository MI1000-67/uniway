import type { LocationReference } from "../locations";

export type ConnectCategory =
  "All" | "Textbooks" | "Tech" | "Supplies" | "Snacks" | "Competitions";

export type VolunteerFocus =
  "All" | "Sustainability" | "Greening" | "Mentorship" | "Events";

export type ItemCondition = "New" | "Like New" | "Good" | "Fair";

export type ItemStatus = "available" | "low_stock" | "reserved" | "sold";

export interface CommunityPost {
  id: string;
  type: "marketplace" | "announcement" | "competition";
  title: string;
  description: string;
  category: "Textbooks" | "Tech" | "Supplies" | "Snacks" | "Competitions";
  price?: number;
  condition?: ItemCondition;
  quantity?: number;
  sellerName: string;
  sellerContact?: string;
  location?: LocationReference;
  locationName: string; // Human readable label (e.g. 'Central Library, Room L202')
  status: ItemStatus;
  badge?: string;
  pickupWindow?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface VolunteerOpportunity {
  id: string;
  title: string;
  organization: string;
  description: string;
  focusArea: "Sustainability" | "Greening" | "Mentorship" | "Events";
  hoursCredit: number;
  spotsTotal: number;
  spotsFilled: number;
  eventDate: string;
  location?: LocationReference;
  locationName: string;
  requirements: string[];
  status: "open" | "closed";
}

export interface VolunteerApplication {
  id: string;
  opportunityId: string;
  applicantName: string;
  applicantEmail: string;
  statement?: string;
  submittedAt: string;
  status: "pending" | "approved" | "declined";
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface InterestPoll {
  id: string;
  question: string;
  author: string;
  options: PollOption[];
  totalVotes: number;
  userVotedOptionId?: string;
  expiresAt: string;
}
