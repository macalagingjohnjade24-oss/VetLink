import { Logo } from '@/ui/Logo';

/** Shown when web/.env has no Supabase credentials, instead of a blank crash. */
export function SetupNotice() {
  return (
    <div className="auth">
      <aside className="auth__rail">
        <Logo />
        <div className="auth__rail-body">
          <p className="auth__rail-eyebrow">Clinic personnel</p>
          <h2 className="auth__rail-title">
            Veterinary Care,
            <br />
            Connected.
          </h2>
          <p className="auth__rail-heading" style={{ marginTop: 40 }}>
            Connect the workspace
          </p>
          <p className="auth__rail-copy">
            The console needs the same Supabase project the VetLink mobile app uses.
          </p>
        </div>
        <p className="auth__rail-footer">VetLink / Clinic workspace</p>
      </aside>
      <main className="auth__panel">
        <div className="auth__panel-header">
          <span>Clinic personnel / Setup</span>
          <span>SETUP</span>
        </div>
        <div className="auth__body">
          <div className="auth__form auth__form--wide">
            <h1 className="auth__title">Supabase is not configured</h1>
            <p className="auth__subtitle">
              Copy <code>web/.env.example</code> to <code>web/.env</code> and fill in the two public
              values from Supabase → Project Settings → API:
            </p>
            <pre
              className="card"
              style={{ marginTop: 18, fontSize: 13, overflowX: 'auto', background: 'var(--surface-muted)' }}
            >
              <code>
                VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co{'\n'}
                VITE_SUPABASE_ANON_KEY=&lt;anon public key&gt;
              </code>
            </pre>
            <p className="auth__note-copy">
              Restart <code>npm run dev</code> after saving. The <code>service_role</code> key must
              never be added here — these values are shipped to the browser.
            </p>
          </div>
        </div>
        <div className="auth__panel-footer">
          <span>&copy; 2026 VetLink. Veterinary Care, Connected.</span>
          <span>VetLink / Clinic workspace</span>
        </div>
      </main>
    </div>
  );
}
