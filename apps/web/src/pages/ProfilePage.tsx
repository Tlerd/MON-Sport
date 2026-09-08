import { useState, type SyntheticEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlayerSkill, Sport, SkillLevel, UserProfile } from '@monsport/shared';
import { fetchProfile, updateProfile } from '../api/users';
import { useSession } from '../hooks/useSession';
import { SkillLevelSelect } from '../components/SkillLevelSelect';
import { vi } from '../i18n/vi';

const ALL_SPORTS: Sport[] = ['FOOTBALL', 'BADMINTON', 'VOLLEYBALL', 'PICKLEBALL'];
const PROFILE_QUERY_KEY = ['profile'] as const;

function toSkillMap(skills: PlayerSkill[]): Record<Sport, SkillLevel> {
  const map = Object.fromEntries(ALL_SPORTS.map((sport) => [sport, 'NEW'])) as Record<
    Sport,
    SkillLevel
  >;
  for (const skill of skills) {
    map[skill.sport] = skill.level;
  }
  return map;
}

export function ProfilePage() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    enabled: Boolean(session),
  });

  if (sessionLoading || (Boolean(session) && profileQuery.isLoading)) {
    return <p className="p-6">{vi.common.loading}</p>;
  }

  if (!session) {
    return <p className="p-6">{vi.profile.pleaseLogin}</p>;
  }

  if (!profileQuery.data) {
    return <p className="p-6 text-red-600">{vi.common.error}</p>;
  }

  // key=profile.id: khi du lieu ho so thay doi danh tinh, remount de state cuc
  // bo khoi tao lai tu dau — tranh dung useEffect+setState de "dong bo" state
  // (anti-pattern, xem react-hooks/set-state-in-effect).
  return <ProfileForm key={profileQuery.data.id} profile={profileQuery.data} />;
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  const [skills, setSkills] = useState<Record<Sport, SkillLevel>>(() => toSkillMap(profile.skills));

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
    },
  });

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateMutation.mutate({
      name: name.trim() === '' ? undefined : name,
      phone: phone.trim() === '' ? undefined : phone,
      avatarUrl: avatarUrl.trim() === '' ? undefined : avatarUrl,
      skills: ALL_SPORTS.map((sport) => ({ sport, level: skills[sport] })),
    });
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">{vi.profile.title}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>{vi.profile.name}</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>{vi.profile.phone}</span>
          <input
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>{vi.profile.avatarUrl}</span>
          <input
            value={avatarUrl}
            onChange={(event) => {
              setAvatarUrl(event.target.value);
            }}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{vi.profile.skills}</legend>
          {ALL_SPORTS.map((sport) => (
            <SkillLevelSelect
              key={sport}
              sport={sport}
              value={skills[sport]}
              onChange={(level) => {
                setSkills((prev) => ({ ...prev, [sport]: level }));
              }}
            />
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-white"
        >
          {vi.profile.save}
        </button>

        {updateMutation.isSuccess && <p className="text-green-600">{vi.profile.saved}</p>}
        {updateMutation.isError && <p className="text-red-600">{vi.profile.saveError}</p>}
      </form>
    </main>
  );
}
