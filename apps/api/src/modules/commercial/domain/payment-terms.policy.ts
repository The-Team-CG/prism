import { BadRequestException } from '@nestjs/common';

export type PaymentTermsPolicy = 'standard' | 'repeat_client_override';

function paymentPercentages(schedule: Array<{ percentage: number }>) {
  if (schedule.length === 0 || schedule.length > 4) {
    throw new BadRequestException('Payment terms must contain between one and four milestones');
  }
  const percentages = schedule.map((item) => Number(item.percentage));
  if (percentages.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new BadRequestException('Payment milestone percentages must be greater than zero');
  }
  if (Math.round(percentages.reduce((sum, value) => sum + value, 0) * 100) !== 10000) {
    throw new BadRequestException('Payment milestone percentages must total 100%');
  }
  return percentages;
}

export function validatePaymentTerms(input: {
  schedule: Array<{ label: string; percentage: number; dueDate?: string }>;
  policy?: PaymentTermsPolicy;
  overrideReason?: string;
}) {
  const percentages = paymentPercentages(input.schedule);
  const firstPercentage = percentages[0];
  if (firstPercentage < 50) {
    if (input.policy !== 'repeat_client_override' || !input.overrideReason?.trim()) {
      throw new BadRequestException('A reasoned repeat-client override is required below the 50% downpayment policy');
    }
    return { state: 'repeat_client_override' as const, overrideReason: input.overrideReason.trim() };
  }
  if (input.policy === 'repeat_client_override' && !input.overrideReason?.trim()) {
    throw new BadRequestException('A reason is required for a repeat-client payment term override');
  }
  return {
    state: input.policy === 'repeat_client_override' ? ('repeat_client_override' as const) : ('standard' as const),
    overrideReason: input.overrideReason?.trim() || null,
  };
}

export function nextPaymentMilestoneStatus(input: { current: string; amountPaid: number; amount: number; requested?: string }) {
  const requested = input.requested;
  if (requested === 'at_risk') {
    return atRiskStatus(input.current);
  }
  validateRequestedStatus(requested);
  if (requested === 'pending' && input.amountPaid > 0) {
    throw new BadRequestException('A milestone with payments cannot return to pending');
  }
  if (requested === 'paid' && input.amountPaid < input.amount) {
    throw new BadRequestException('A milestone cannot be marked paid before its amount is received');
  }
  if (input.amountPaid >= input.amount) return 'paid';
  if (input.amountPaid > 0) return 'partially_paid';
  return requested ?? input.current;
}

function atRiskStatus(current: string) {
  if (current === 'paid') throw new BadRequestException('A paid milestone cannot become at risk');
  return 'at_risk';
}

function validateRequestedStatus(requested?: string) {
  if (requested && requested !== 'pending' && requested !== 'paid') {
    throw new BadRequestException('Unsupported payment milestone status');
  }
}
