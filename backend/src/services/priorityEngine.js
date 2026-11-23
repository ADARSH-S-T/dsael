import { localDb, supabase, isSupabaseConfigured } from '../config/supabase.js';

/**
 * AUTOMATIC PRIORITY ALLOCATION ENGINE
 * 
 * Rules:
 * 1. Match against active administrator-approved priority rules.
 * 2. Checks test category and optional rule condition keywords.
 * 3. Priority levels: HIGH, MEDIUM, LOW.
 * 4. Fallback: If no rule matches or conflict occurs, set status to AWAITING_ADMIN_REVIEW.
 *    Does NOT invent clinical decisions or assign random priorities!
 */

export async function getActivePriorityRules() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('priority_rules')
      .select('*')
      .eq('is_active', true);
    if (!error && data) return data;
  }
  return localDb.get('priority_rules').filter(r => r.is_active);
}

export async function evaluateTestPriority(testData) {
  const rules = await getActivePriorityRules();
  const testCategory = (testData.test_category || '').trim();
  const testName = (testData.test_name || '').toLowerCase();
  const sampleDetails = (testData.sample_details || '').toLowerCase();

  // Find rules matching the category
  const matchingRules = rules.filter(r => 
    r.test_category.toLowerCase() === testCategory.toLowerCase()
  );

  if (matchingRules.length === 0) {
    return {
      success: false,
      priority: null,
      source: null,
      status: 'AWAITING_ADMIN_REVIEW',
      reason: `No active priority rule found for laboratory category "${testCategory}". Requires administrative triage.`
    };
  }

  // If single rule matches category
  if (matchingRules.length === 1) {
    const rule = matchingRules[0];
    return {
      success: true,
      priority: rule.configured_priority,
      source: 'AUTOMATIC',
      status: 'WAITING_IN_QUEUE',
      reason: `Matched active rule: "${rule.rule_name}" (${rule.configured_priority} priority, deadline: ${rule.processing_deadline} mins).`,
      rule_id: rule.id
    };
  }

  // If multiple rules for this category, evaluate keyword specificity in conditions
  let specificMatch = null;
  for (const rule of matchingRules) {
    const keywords = rule.rule_conditions?.keywords || [];
    for (const kw of keywords) {
      if (testName.includes(kw.toLowerCase()) || sampleDetails.includes(kw.toLowerCase())) {
        specificMatch = rule;
        break;
      }
    }
    if (specificMatch) break;
  }

  if (specificMatch) {
    return {
      success: true,
      priority: specificMatch.configured_priority,
      source: 'AUTOMATIC',
      status: 'WAITING_IN_QUEUE',
      reason: `Matched specific rule condition in: "${specificMatch.rule_name}" (${specificMatch.configured_priority}).`,
      rule_id: specificMatch.id
    };
  }

  // Conflict or ambiguity: fallback to Admin Review
  return {
    success: false,
    priority: null,
    source: null,
    status: 'AWAITING_ADMIN_REVIEW',
    reason: `Multiple rules found for category "${testCategory}" with no unambiguous keyword match. Sent for medical review.`
  };
}

export async function recordPriorityHistory({ testId, previousPriority, newPriority, method, reason, changedBy }) {
  const historyItem = {
    test_id: testId,
    previous_priority: previousPriority,
    new_priority: newPriority,
    assignment_method: method, // 'AUTOMATIC' or 'MANUAL'
    reason: reason,
    changed_by: changedBy || null,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    await supabase.from('priority_history').insert([historyItem]);
  } else {
    localDb.insert('priority_history', historyItem);
  }
}
