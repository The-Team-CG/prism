import { Logger } from '@nestjs/common';
import { analyzePareBudget, assessPareRisk, draftPareMessages } from '@prism/pare-core';
import {
  submitPareBudgetAnalysisSchema,
  submitPareMessageDraftsSchema,
  submitPareRiskAssessmentSchema,
  type PAREBudgetAnalysis,
  type PARECandidate,
  type PAREContext,
  type PAREDrafts,
  type PARERisk,
  type SubmitPAREBudgetAnalysisInput,
  type SubmitPAREMessageDraftsInput,
  type SubmitPARERiskAssessmentInput,
} from '@prism/types';

/**
 * Bridge from the PARE interface to the deployed agent apps.
 *
 * The agents themselves live in `apps/agent-*` (eve apps). This gateway only
 * decides who answers a step: in `live` mode the matching agent app does, and
 * otherwise — or whenever it is unreachable, misconfigured or slow — the
 * deterministic `@prism/pare-core` verdict does. PARE must always return
 * something for a PMCM Admin to approve, so a failing agent degrades rather
 * than aborting the run.
 */

export type PareMode = 'mock' | 'live';

/** Audit `modelVersion` recorded when an agent app produced the analyses. */
export const PARE_LIVE_MODEL_VERSION = 'eve-agents';

type PareAgentName = 'budget' | 'risk' | 'message-drafter';

const AGENT_URL_ENV: Record<PareAgentName, string> = {
  budget: 'PRISM_PARE_BUDGET_AGENT_URL',
  risk: 'PRISM_PARE_RISK_AGENT_URL',
  'message-drafter': 'PRISM_PARE_DRAFTER_AGENT_URL',
};

/** Minimal surface this gateway uses from `eve/client`. */
type EveMessageResult<T> = { status: string; data?: T };
type EveSession = {
  send<T>(payload: { message: string; outputSchema: unknown }): Promise<{
    result(): Promise<EveMessageResult<T>>;
  }>;
};
type EveClient = { session(): EveSession };
type EveClientModule = {
  Client: new (options: { host: string; auth?: { bearer?: () => Promise<string> } }) => EveClient;
};

export class PareAgentGateway {
  private readonly logger = new Logger(PareAgentGateway.name);

  constructor(private readonly mode: PareMode) {}

  async runBudgetAgent(ctx: PAREContext, candidate: PARECandidate): Promise<PAREBudgetAnalysis> {
    const submitted = await this.ask<SubmitPAREBudgetAnalysisInput>(
      'budget',
      submitPareBudgetAnalysisSchema,
      this.budgetBrief(ctx, candidate),
    );
    if (!submitted) return analyzePareBudget(ctx, candidate);

    // The agent judges the shortlist it was given; it does not re-pick the candidate.
    return { ...submitted, selectedCandidate: candidate };
  }

  async runRiskAgent(ctx: PAREContext): Promise<PARERisk> {
    const submitted = await this.ask<SubmitPARERiskAssessmentInput>(
      'risk',
      submitPareRiskAssessmentSchema,
      this.riskBrief(ctx),
    );
    return submitted ?? assessPareRisk(ctx);
  }

  async runMessageDrafterAgent(ctx: PAREContext): Promise<PAREDrafts> {
    const submitted = await this.ask<SubmitPAREMessageDraftsInput>(
      'message-drafter',
      submitPareMessageDraftsSchema,
      this.draftBrief(ctx),
    );
    return submitted ?? draftPareMessages(ctx);
  }

  /**
   * One turn against one agent app. Returns `null` for every "use the
   * deterministic answer instead" case, so callers have a single fallback path.
   */
  private async ask<T>(agent: PareAgentName, outputSchema: unknown, message: string): Promise<T | null> {
    if (this.mode !== 'live') return null;

    const host = process.env[AGENT_URL_ENV[agent]];
    if (!host) {
      this.logger.warn(
        `PARE is in live mode but ${AGENT_URL_ENV[agent]} is unset — using the deterministic ${agent} verdict.`,
      );
      return null;
    }

    try {
      // Dynamic import keeps `eve/client` out of the API's startup path, the same
      // way the previous in-process agents loaded the Anthropic SDK on demand.
      const specifier = 'eve/client';
      const { Client } = (await import(specifier)) as EveClientModule;
      const token = process.env['PRISM_PARE_AGENT_TOKEN'];
      const client = new Client({
        host,
        ...(token ? { auth: { bearer: async () => token } } : {}),
      });

      const response = await client.session().send<T>({ message, outputSchema });
      const result = await response.result();
      if (result.data === undefined) {
        this.logger.warn(`PARE ${agent} agent returned no structured result (status ${result.status}).`);
        return null;
      }
      return result.data;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`PARE ${agent} agent call failed: ${reason}`);
      return null;
    }
  }

  /**
   * Each brief is one instruction plus the context as JSON, because the agent's
   * tools take the context as input. Names are sent as-is: the drafting agent
   * cannot write a usable letter to "S. [SURNAME]". Sanitization happens on the
   * way into the audit log, not on the way to the agent — same as before the
   * agents moved out of this module.
   */
  private budgetBrief(ctx: PAREContext, candidate: PARECandidate): string {
    return this.brief(
      `Assess budget feasibility for replacing ${ctx.withdrawnSupplier.name} on "${ctx.eventName}" with ${candidate.supplierName}.`,
      { context: ctx, candidate },
    );
  }

  private riskBrief(ctx: PAREContext): string {
    return this.brief(
      `Assess the operational risk of replacing ${ctx.withdrawnSupplier.name} on "${ctx.eventName}".`,
      { context: ctx },
    );
  }

  private draftBrief(ctx: PAREContext): string {
    return this.brief(
      `Draft the supplier notification and the client reassurance message for the replacement of ${ctx.withdrawnSupplier.name} on "${ctx.eventName}".`,
      { context: ctx },
    );
  }

  private brief(instruction: string, payload: Record<string, unknown>): string {
    return `${instruction}\n\n${JSON.stringify(payload)}`;
  }
}
