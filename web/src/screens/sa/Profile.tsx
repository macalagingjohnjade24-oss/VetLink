import { AccountProfile } from '@/screens/shared/AccountProfile';

/** SA-16 — the administrator's own account, security and session. */
export function AdminProfile() {
  return (
    <AccountProfile
      detailsAudience="Shown to other administrators in the console"
      scopeRows={[{ term: 'Scope', value: 'Platform-wide · clinical records stay clinic-scoped' }]}
      roleNote="Your role is written by the service role only. If platform access needs to change, it is done by another System Administrator through the provisioning flow — a browser session cannot grant itself a role."
    />
  );
}
