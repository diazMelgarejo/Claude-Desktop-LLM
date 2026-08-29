/**
 * Literal `{{variable}}` substitution -- replaces the old
 * `new RegExp(`{{${key}}}`, 'g')` pattern, which let a user-supplied variable
 * key containing regex metacharacters throw or alter replacement behavior.
 * No RegExp is ever constructed from user input here.
 */
export function substituteTemplate(template: string, variables: Record<string, unknown> | undefined): string {
  if (!variables) return template;
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(`{{${key}}}`).join(String(value));
  }
  return result;
}
