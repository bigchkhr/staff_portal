function compare(actual, operator, expected) {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'contains':
      return Array.isArray(actual)
        ? actual.includes(expected)
        : String(actual ?? '').includes(String(expected));
    default:
      return true;
  }
}

function shouldRunStep(condition, values) {
  if (!condition || !condition.stepKey) return true;
  return compare(values[condition.stepKey], condition.operator || 'eq', condition.value);
}

module.exports = { shouldRunStep };
