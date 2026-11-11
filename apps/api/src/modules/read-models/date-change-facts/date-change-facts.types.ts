export interface MilestoneFactsShape {
  id: string;
  label: string;
  amount: number;
  amountPaid: number;
  remainingBalance: number;
  /** Calendar date, YYYY-MM-DD. */
  dueDate: string;
}

export interface ApprovedWorkFactsShape {
  conformeSigned: boolean;
  proposalApproved: boolean;
  floorPlanApproved: boolean;
  billingSent: boolean;
}
