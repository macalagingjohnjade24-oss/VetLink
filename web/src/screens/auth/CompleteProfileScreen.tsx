import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROLE_HOME, ROLE_LABEL } from '@/auth/roles';
import { useAuth } from '@/auth/AuthProvider';
import { AuthLayout } from '@/layout/AuthLayout';
import { supabase } from '@/lib/supabase';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

export function CompleteProfileScreen() {
  const { user, refresh, status } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setMobile(user.mobile);
    setAvatarUrl(user.avatarUrl);
  }, [user]);

  if (status === 'loading') return <p className="auth__spinner">Loading…</p>;
  if (status === 'ready' && !user) return <Navigate to="/login" replace />;
  if (!user) return null;
  const account = user;

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${account.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      setNotice('Photo uploaded. Save the profile to keep it.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload that photo.');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }

    setBusy(true);
    try {
      const { error: saveError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          mobile_number: mobile.trim() || null,
          profile_picture: avatarUrl,
        })
        .eq('id', account.id);
      if (saveError) throw new Error(saveError.message);

      await refresh();
      navigate(ROLE_HOME[account.role], { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile.');
    } finally {
      setBusy(false);
    }
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'VL';

  return (
    <AuthLayout
      code="AUTH-06"
      breadcrumb="Clinic personnel / Staff profile"
      wide
      footerRight="Your role is assigned by your Clinic Administrator."
    >
      <p className="auth__eyebrow">Complete your profile</p>
      <h1 className="auth__title">Staff Profile</h1>
      <p className="auth__subtitle">
        Add the details your clinic team sees next to your name. Your email and role are managed by
        VetLink.
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="auth__fields">
          <div className="auth__photo-row">
            <span className="avatar auth__photo-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
            </span>
            <div>
              <label className="btn btn--outline btn--sm" htmlFor="profile-photo">
                {uploading ? 'Uploading…' : 'Upload photo'}
              </label>
              <input
                id="profile-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="visually-hidden"
                onChange={(event) => void uploadPhoto(event)}
                disabled={uploading || busy}
              />
              <p className="field__hint">JPG, PNG or WebP. Square photos look best.</p>
            </div>
          </div>

          <div className="auth__meta">
            <Input
              label="First name"
              name="first_name"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={busy}
            />
            <Input
              label="Last name"
              name="last_name"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={busy}
            />
          </div>

          <Input
            label="Contact number"
            name="mobile"
            type="tel"
            autoComplete="tel"
            placeholder="+63 917 000 0000"
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
            disabled={busy}
          />

          <Input
            label="Email address"
            name="email"
            type="email"
            value={user.email}
            readOnly
            disabled
            hint="Contact VetLink support to change the account email."
          />

          <Input
            label="Assigned role"
            name="role"
            value={ROLE_LABEL[user.role]}
            readOnly
            disabled
            hint={
              user.clinicName
                ? `Clinic: ${user.clinicName}`
                : 'A System Administrator account has platform-wide access.'
            }
          />
        </div>

        {notice ? (
          <div className="alert alert--success auth__alert" role="status">
            <Icon name="check" size={18} />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className="alert alert--error auth__alert" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="auth__submit">
          <Button type="submit" size="auth" loading={busy}>
            {busy ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
