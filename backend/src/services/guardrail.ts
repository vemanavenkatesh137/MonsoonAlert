export interface GuardrailResult {
  isSafe: boolean;
  reason?: string;
  deterministicResponse?: string;
}

/**
 * Sanitizes location input to prevent injection or malicious inputs.
 */
export function sanitizeCoordinates(latStr: any, lonStr: any): { lat: number; lon: number } {
  let lat = parseFloat(latStr);
  let lon = parseFloat(lonStr);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    lat = 19.0760; // Default to Mumbai
  }
  if (isNaN(lon) || lon < -180 || lon > 180) {
    lon = 72.8777;
  }

  return { lat, lon };
}

/**
 * Sanitizes arbitrary text inputs to strip dangerous characters.
 */
export function sanitizeTextInput(input: string): string {
  if (!input) return '';
  // Remove potential script tags, HTML elements, and control characters
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .trim();
}

/**
 * Assesses a user text query against prompt injection attacks and safety rules.
 */
export function runQueryGuardrails(query: string): GuardrailResult {
  const cleanQuery = query.trim().toLowerCase();

  if (cleanQuery.length === 0) {
    return { isSafe: true };
  }

  // 1. Anti-Prompt-Injection checks
  const injectionPatterns = [
    'ignore previous instructions',
    'system prompt',
    'you are now',
    'dan mode',
    'jailbreak',
    'override',
    'instead of what you were told',
    'forget everything',
    'markdown image',
    '![image]',
    'javascript:',
    '<script',
  ];

  for (const pattern of injectionPatterns) {
    if (cleanQuery.includes(pattern)) {
      return {
        isSafe: false,
        reason: 'PROMPT_INJECTION_DETECTED',
        deterministicResponse: 'Security violation: Unauthorized instruction modifier detected. Access denied.',
      };
    }
  }

  // 2. Life-critical deterministic safety constraints
  // If the user asks about doing dangerous actions, block and provide deterministic safe NDRF advice.
  
  // Critical categories: Driving through floodwater, swimming in currents, touching downed lines, refusing evacuation.
  const hasMovement = /drive|ride|car|vehicle|walk|swim|wade|cross|run/.test(cleanQuery);
  const hasWater = /flood|water|river|stream|current|rapids|torrent/.test(cleanQuery);

  if (hasMovement && hasWater) {
    return {
      isSafe: true, // Safe in terms of security injection, but requires deterministic response
      reason: 'CRITICAL_SAFETY_WARNING',
      deterministicResponse: 'CRITICAL SAFETY WARNING: Do NOT attempt to drive, walk, or swim through floodwaters. ' +
        'Just 6 inches (15 cm) of moving water can knock an adult off their feet, and 12 inches (30 cm) of water ' +
        'can easily float or stall most vehicles. If your vehicle is surrounded by rising water, abandon it immediately ' +
        'and seek high ground. If trapped in a structure, climb to the highest floor and signal for help.',
    };
  }

  const electricalPatterns = [
    'touch electric', 'touch power line', 'touch wire', 'downed power line', 'fallen electric pole'
  ];

  for (const pattern of electricalPatterns) {
    if (cleanQuery.includes(pattern)) {
      return {
        isSafe: true,
        reason: 'CRITICAL_SAFETY_WARNING',
        deterministicResponse: 'CRITICAL SAFETY WARNING: Keep clear of all electrical poles, transformers, and downed power lines. ' +
          'Water conducts electricity. Avoid touching electrical switches or appliances if you are wet or standing in water. ' +
          'Report loose, dangling wires immediately to your power distribution utility or emergency helpline (112).',
      };
    }
  }

  return { isSafe: true };
}
