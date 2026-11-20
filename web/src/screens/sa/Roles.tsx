import { downloadCsv } from '@/lib/format';
import {
  ConsoleFooter,
  Notice,
  PageHeader,
  Panel,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

type Access = 'yes' | 'no' | 'partial';

const ROLES = [
  { key: 'sa', label: 'System admin' },
  { key: 'ca', label: 'Clinic admin' },
  { key: 'am', label: 'Appointment manager' },
  { key: 'vet', label: 'Veterinarian' },
  { key: 'cs', label: 'Clinic staff' },
  { key: 'owner', label: 'Pet owner' },
] as const;

type RoleKey = (typeof ROLES)[number]['key'];

type Capability = {
  area: string;
  name: string;
  detail: string;
  access: Record<RoleKey, Access>;
};

const CAPABILITIES: Capability[] = [
  {
    area: 'Platform',
    name: 'Review clinic applications',
    detail: 'Reject, or request additional information (review_clinic_application).',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Platform',
    name: 'Approve a clinic and provision its administrator',
    detail: 'Runs in the service role through the provision-clinic-admin function.',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Platform',
    name: 'Suspend, reactivate or close a clinic',
    detail: 'set_clinic_status, audited against the acting administrator.',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Platform',
    name: 'Read every clinic and profile',
    detail: 'Platform-wide policies; clinical records stay clinic-scoped.',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Platform',
    name: 'Read the platform audit log',
    detail: 'Only the platform_audit_log read policy grants this.',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Platform',
    name: 'Send platform announcements',
    detail: 'send_platform_announcement, to a chosen audience.',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Platform',
    name: 'Change platform settings',
    detail: 'The single platform_settings row.',
    access: { sa: 'yes', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Account roles',
    name: 'Change an account role',
    detail: 'Service role only — no browser client can write profiles.role.',
    access: { sa: 'no', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Clinic',
    name: 'Edit the clinic profile and services',
    detail: 'Only the clinic_administrator membership passes is_clinic_admin.',
    access: { sa: 'no', ca: 'yes', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Clinic',
    name: 'Invite and manage clinic staff',
    detail: 'Clinic admin only, through the invite-staff function.',
    access: { sa: 'no', ca: 'yes', am: 'no', vet: 'no', cs: 'no', owner: 'no' },
  },
  {
    area: 'Clinic',
    name: 'Read clinic appointments',
    detail: 'Any active membership of that clinic.',
    access: { sa: 'no', ca: 'yes', am: 'yes', vet: 'yes', cs: 'yes', owner: 'no' },
  },
  {
    area: 'Clinic',
    name: 'Confirm or cancel appointments',
    detail: 'Policy allows any active member; the console UI narrows it by role.',
    access: { sa: 'no', ca: 'yes', am: 'yes', vet: 'partial', cs: 'partial', owner: 'no' },
  },
  {
    area: 'Clinic',
    name: 'Write medical records and vaccinations',
    detail: 'Policy allows any active member; the console UI narrows it by role.',
    access: { sa: 'no', ca: 'yes', am: 'partial', vet: 'yes', cs: 'partial', owner: 'no' },
  },
  {
    area: 'Own records',
    name: 'Book and manage own appointments',
    detail: 'owner_id must equal the signed-in user.',
    access: { sa: 'no', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'yes' },
  },
  {
    area: 'Own records',
    name: 'Read own pets, records and vaccinations',
    detail: 'Ownership check in every pet and record policy.',
    access: { sa: 'no', ca: 'no', am: 'no', vet: 'no', cs: 'no', owner: 'yes' },
  },
];

function Cell({ value }: { value: Access }) {
  if (value === 'yes') {
    return (
      <span className="matrix__yes" title="Allowed">
        <Icon name="check" size={16} />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="matrix__partial" title="Allowed by the policy, narrowed in the console UI">
        Limited
      </span>
    );
  }
  return (
    <span className="matrix__no" title="Not allowed">
      —
    </span>
  );
}

/** SA-10 — the enforced role model, documented rather than editable. */
export function RolesAndAccess() {
  const exportMatrix = () =>
    downloadCsv(
      'vetlink-role-matrix.csv',
      ['Area', 'Capability', 'Detail', ...ROLES.map((role) => role.label)],
      CAPABILITIES.map((capability) => [
        capability.area,
        capability.name,
        capability.detail,
        ...ROLES.map((role) => capability.access[role.key]),
      ]),
    );

  return (
    <div className="page">
      <PageHeader
        title="Roles and access reference"
        subtitle="Reference documentation of intended access. It is not read from the live database."
        actions={
          <Button variant="outline" onClick={exportMatrix}>
            Export matrix
          </Button>
        }
      />

      <Notice tone="info">
        <strong>Reference only.</strong> The matrix below is static text written by hand from the
        policies in <strong>supabase/migrations</strong> and the two Edge Functions. It does not reflect
        live permissions and will not update if policies change. The enforced access is defined by the
        database policies. <strong>profiles.role</strong> is written only by the service role, so no browser
        session, including this one, can grant itself access.
      </Notice>

      <div className="grid grid--two">
        <Panel title="System Administrator" subtitle="Platform-wide, outside any clinic">
          <ul className="stack--sm" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>Reviews and decides clinic applications.</li>
            <li>Approves clinics and provisions their Clinic Administrator.</li>
            <li>Suspends, reactivates and closes clinic accounts.</li>
            <li>Reads platform-wide counts, the directory and audit logs.</li>
            <li>Sends platform announcements and maintains platform settings.</li>
            <li>
              <strong>Cannot read</strong> a clinic's patients or medical records — those policies
              stay clinic-scoped.
            </li>
          </ul>
        </Panel>
        <Panel title="Clinic Administrator" subtitle="One clinic, never the platform">
          <ul className="stack--sm" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>Manages that clinic's profile, services and staff invitations.</li>
            <li>Reads and updates that clinic's appointments and clinical records.</li>
            <li>
              <strong>Cannot</strong> see another clinic, the platform directory, audit logs or
              platform settings.
            </li>
            <li>
              <strong>Cannot</strong> approve clinics, change roles or manage platform accounts.
            </li>
          </ul>
        </Panel>
      </div>

      <Panel
        title="Permission matrix (reference)"
        subtitle="Hand-written reference. Limited = the policy allows it, but that role's console UI does not offer it."
        flush
      >
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Capability</th>
                {ROLES.map((role) => (
                  <th key={role.key}>{role.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((capability) => (
                <tr key={capability.name}>
                  <td>
                    <p className="table__primary">{capability.name}</p>
                    <p className="table__secondary">
                      {capability.area} · {capability.detail}
                    </p>
                  </td>
                  {ROLES.map((role) => (
                    <td key={role.key}>
                      <Cell value={capability.access[role.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <ConsoleFooter right="Role changes require the service role" />
    </div>
  );
}
