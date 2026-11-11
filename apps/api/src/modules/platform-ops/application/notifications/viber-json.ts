export function parseViberJson(raw: string): unknown {
  return JSON.parse(raw, (key: string, value: unknown, context?: { source?: string }) => {
    if (key === 'message_token' && typeof value === 'number') {
      if (!context?.source || !/^[0-9]+$/.test(context.source)) throw new Error('Invalid Viber message token');
      return context.source;
    }
    return value;
  });
}
