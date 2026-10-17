import type {
  GameRuleDefinition,
  GameRuleRegistryPort,
  GameTemplateId,
} from '../contracts/game-rule.port';

export class GameRuleRegistry implements GameRuleRegistryPort {
  private readonly definitions = new Map<GameTemplateId, GameRuleDefinition>();

  get(templateId: GameTemplateId): GameRuleDefinition | undefined {
    return this.definitions.get(templateId);
  }

  register(definition: GameRuleDefinition): void {
    if (this.definitions.has(definition.templateId)) {
      throw new Error('Event game rule already registered');
    }
    this.definitions.set(definition.templateId, definition);
  }
}
