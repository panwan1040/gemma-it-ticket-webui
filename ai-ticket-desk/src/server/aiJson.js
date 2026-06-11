export function cleanupJsonText(output) {
  const withoutFences = String(output ?? '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const first = withoutFences.indexOf('{');
  const last = withoutFences.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return withoutFences;
  return withoutFences.slice(first, last + 1).trim();
}

export function parseAiJson(output, schema) {
  const cleaned = cleanupJsonText(output);
  try {
    const parsed = JSON.parse(cleaned);
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      return {
        ok: false,
        error: 'VALIDATION_FAILED',
        message: 'AI JSON did not match the expected ticket schema.',
        issues: validated.error.issues,
        cleaned
      };
    }
    return { ok: true, data: validated.data, cleaned };
  } catch (error) {
    return {
      ok: false,
      error: 'PARSE_FAILED',
      message: 'AI response was not valid JSON.',
      detail: error.message,
      cleaned
    };
  }
}
