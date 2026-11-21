/**
 * Edge Functions link existing accounts by email. Neither invitation nor
 * provisioning may turn a System Administrator into clinic staff: that would
 * strip platform access while the caller still sees a success response.
 *
 * @param {string | null | undefined} role the existing profile's role, if any
 * @returns {string | null} a user-facing error, or null when linking is allowed
 */
export function profileLinkError(role) {
  if (role === 'system_administrator') {
    return 'This account is a System Administrator and cannot be linked to a clinic role. Use a different email.';
  }
  return null;
}
