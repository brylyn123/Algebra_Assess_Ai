const SUBJECT_CARD_THEMES = [
  {
    surfaceClass: 'bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(224,231,255,0.95))] border-blue-100',
    accentClass: 'from-sky-400 via-blue-500 to-indigo-500',
    badgeClass: 'bg-blue-50 text-blue-700',
    chipClass: 'border-blue-100 bg-white/90 text-slate-700',
  },
  {
    surfaceClass: 'bg-[linear-gradient(135deg,rgba(240,253,250,1),rgba(220,252,231,0.95))] border-emerald-100',
    accentClass: 'from-emerald-400 via-teal-500 to-cyan-500',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    chipClass: 'border-emerald-100 bg-white/90 text-slate-700',
  },
  {
    surfaceClass: 'bg-[linear-gradient(135deg,rgba(255,247,237,1),rgba(254,243,199,0.95))] border-amber-100',
    accentClass: 'from-amber-400 via-orange-500 to-rose-500',
    badgeClass: 'bg-amber-50 text-amber-700',
    chipClass: 'border-amber-100 bg-white/90 text-slate-700',
  },
  {
    surfaceClass: 'bg-[linear-gradient(135deg,rgba(250,245,255,1),rgba(243,232,255,0.95))] border-violet-100',
    accentClass: 'from-violet-400 via-fuchsia-500 to-purple-500',
    badgeClass: 'bg-violet-50 text-violet-700',
    chipClass: 'border-violet-100 bg-white/90 text-slate-700',
  },
  {
    surfaceClass: 'bg-[linear-gradient(135deg,rgba(255,241,242,1),rgba(254,226,226,0.95))] border-rose-100',
    accentClass: 'from-rose-400 via-pink-500 to-red-500',
    badgeClass: 'bg-rose-50 text-rose-700',
    chipClass: 'border-rose-100 bg-white/90 text-slate-700',
  },
  {
    surfaceClass: 'bg-[linear-gradient(135deg,rgba(240,249,255,1),rgba(191,219,254,0.95))] border-sky-100',
    accentClass: 'from-sky-400 via-cyan-500 to-blue-500',
    badgeClass: 'bg-sky-50 text-sky-700',
    chipClass: 'border-sky-100 bg-white/90 text-slate-700',
  },
];

const hashString = (value) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

export const getSubjectCardTheme = (subject) => {
  const key = String(
    subject?.id ??
      subject?.subject_id ??
      subject?.name ??
      subject?.subject_name ??
      'subject'
  );

  return SUBJECT_CARD_THEMES[hashString(key) % SUBJECT_CARD_THEMES.length];
};

