import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { supabase } from '@/lib/supabase';
import { fetchMyApplication, type MyApplication } from '@/register/data';
import { Notice } from '@/sa/components';
import { Button } from '@/ui/Button';
import { RegisterLayout } from './RegisterLayout';

const COPY: Record<string, { title: string; lead: string; label: string }> = {
  pending: {
    title: 'Registration pending approval',
    lead: 'Your application is in the review queue. You’ll be notified when its status changes.',
    label: 'Pending review',
  },
  approved: {
    title: 'Your clinic is approved',
    lead: 'Welcome to VetLink. Sign in to your clinic workspace to finish your profile and invite your team.',
    label: 'Approved',
  },
  rejected: {
    title: 'Registration not approved',
    lead: 'A System Administrator reviewed your application and could not approve it as submitted.',
    label: 'Not approved',
  },
};

function Timeline({ application }: { application: MyApplication }) {
  const decided = application.status === 'approved' || application.status === 'rejected';
  const steps: [string, string][] = [
    ['Application submitted', application.submitted_at ? formatDateTime(application.submitted_at) : 'Received'],
    ['Documents received', `${application.document_count} file${application.document_count === 1 ? '' : 's'}`],
    [
      'Queued for review',
      application.review_notes && !decided ? 'Additional information requested' : 'System Administrator review',
    ],
    [
      'Decision and activation',
      decided && application.reviewed_at ? formatDateTime(application.reviewed_at) : 'Pending',
    ],
  ];
  return (
    <ol className="reg-timeline">
      {steps.map(([title, note], index) => (
        <li key={title}>
          <b>{String(index + 1).padStart(2, '0')}</b>
          <span>{title}</span>
          <small>{note}</small>
        </li>
      ))}
    </ol>
  );
}

/** REG-08 / REG-09 / REG-10 — the applicant's own application status. */
export function RegisterStatus() {
  const navigate = useNavigate();
  const submitted = (useLocation().state as { submitted?: string | null } | null)?.submitted;
  const state = useAsync(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { signedIn: false as const, application: null };
    return { signedIn: true as const, application: await fetchMyApplication() };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (state.loading) {
    return (
      <RegisterLayout>
        <p className="muted">Loading your application…</p>
      </RegisterLayout>
    );
  }

  if (state.error || !state.data) {
    return (
      <RegisterLayout>
        <Notice tone="error">{state.error ?? 'The application could not be loaded.'}</Notice>
        <Button variant="outline" onClick={state.reload} style={{ marginTop: 12 }}>
          Try again
        </Button>
      </RegisterLayout>
    );
  }

  const { signedIn, application } = state.data;

  if (!signedIn || !application) {
    return (
      <RegisterLayout>
        <div className="reg-form" style={{ maxWidth: 560, margin: '0 auto' }}>
          <p className="reg__eyebrow">Application status</p>
          <h1 className="reg__title">{signedIn ? 'No application yet' : 'Sign in to see your application'}</h1>
          <p className="reg__lead">
            {signedIn
              ? 'This account has not submitted a clinic application.'
              : 'Use the email and password you created when you applied.'}
          </p>
          <div className="reg-actions">
            <Link to={signedIn ? '/register/apply' : '/login'}>
              <Button>{signedIn ? 'Start an application' : 'Sign in'}</Button>
            </Link>
          </div>
        </div>
      </RegisterLayout>
    );
  }

  const copy = COPY[application.status] ?? COPY.pending;
  const needsInfo = application.status === 'pending' && Boolean(application.review_notes);

  return (
    <RegisterLayout>
      <div className="reg-status">
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          <div>
            <p className="reg__eyebrow">Application status · {application.reference ?? 'Reference pending'}</p>
            <h1 className="reg__title">{needsInfo ? 'Additional information required' : copy.title}</h1>
            <p className="reg__lead">{copy.lead}</p>
          </div>

          {submitted !== undefined ? (
            <Notice tone="success">Application submitted successfully. Keep your reference number for support.</Notice>
          ) : null}

          <div className="reg-form">
            <h2 style={{ fontSize: 18 }}>{application.clinic_name}</h2>
            <p style={{ color: application.status === 'approved' ? 'var(--success)' : 'var(--brand)', fontWeight: 600 }}>
              {needsInfo ? 'Waiting on you' : copy.label}
            </p>
            <div className="reg-review">
              <dl>
                <dt>Application reference</dt>
                <dd>{application.reference ?? '—'}</dd>
                <dt>Submitted</dt>
                <dd>{application.submitted_at ? formatDateTime(application.submitted_at) : '—'}</dd>
              </dl>
            </div>
          </div>

          {application.review_notes ? (
            <div className="reg-form">
              <h3 style={{ fontSize: 15, color: 'var(--brand)' }}>Reviewer remarks</h3>
              <p>{application.review_notes}</p>
            </div>
          ) : null}

          {application.status === 'approved' ? (
            <p className="stat__note">
              If the workspace still says access is restricted, sign out and sign in again so your new role loads.
            </p>
          ) : (
            <div>
              <h3 style={{ fontSize: 15, color: 'var(--brand)' }}>Clinic account access is not yet active</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                You cannot manage clinic operations or invite personnel until your application is approved.
              </p>
            </div>
          )}

          <div className="reg-actions" style={{ justifyContent: 'flex-start' }}>
            {application.status === 'approved' ? (
              <Button onClick={() => void signOut()}>Sign in to your workspace</Button>
            ) : application.status === 'rejected' ? (
              <>
                <Link to="/register/apply">
                  <Button>Submit a new application</Button>
                </Link>
                <Button variant="outline" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button onClick={() => void signOut()}>Return to login</Button>
            )}
          </div>
          <p className="stat__note">Need help? Contact VetLink support and include your reference number.</p>
        </div>

        <aside className="reg-form">
          <h2 style={{ fontSize: 18 }}>Application activity</h2>
          <Timeline application={application} />
        </aside>
      </div>
    </RegisterLayout>
  );
}
