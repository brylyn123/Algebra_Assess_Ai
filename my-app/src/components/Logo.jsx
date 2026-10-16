import React from 'react';

const ACCENT = '#f97316';

const OUTER_HEX = 'M60 6L106.77 33L106.77 87L60 114L13.23 87L13.23 33Z';
const INNER_HEX = 'M60 13.5L100.27 36.75L100.27 83.25L60 106.5L19.73 83.25L19.73 36.75Z';
const SET_SQUARE = 'M32 44L32 80L78 80Z';
const HATCH =
    'M40 80L34 87M47 80L41 87M54 80L48 87M61 80L55 87M68 80L62 87M75 80L69 87';

/**
 * The mark: an open hexagon frame in double outline, holding an orange
 * set-square with hatching and an italic "f(x)".
 *
 * `ink="dark"`  -> black linework, for light backgrounds
 * `ink="light"` -> white linework, for dark/blue backgrounds
 */
export const LogoMark = ({ size = 40, ink = 'dark', className = '' }) => {
    const line = ink === 'light' ? '#ffffff' : '#111827';
    const simple = size < 30;
    const k = simple ? 1.7 : 1;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 120 120"
            width={size}
            height={size}
            className={className}
            role="img"
            aria-label="AlgebraAssess"
        >
            <g fill="none" stroke={line} strokeLinecap="round" strokeLinejoin="round">
                <path d={OUTER_HEX} strokeWidth={6 * k} />
                {!simple && <path d={INNER_HEX} strokeWidth={3.5 * k} />}
            </g>
            <g fill="none" stroke={ACCENT} strokeLinecap="round" strokeLinejoin="round">
                <path d={SET_SQUARE} strokeWidth={5 * k} />
                {!simple && <path d={HATCH} strokeWidth={3.2 * k} />}
            </g>
            {!simple && (
                <text
                    x="53"
                    y="59"
                    fontSize="24"
                    fontStyle="italic"
                    fontWeight="700"
                    fontFamily="Georgia, 'Times New Roman', serif"
                    fill={ACCENT}
                >
                    f(x)
                </text>
            )}
        </svg>
    );
};

/**
 * Lockup: mark + stacked uppercase wordmark, matching the reference style.
 */
const Logo = ({ size = 44, ink = 'dark', className = '', showWordmark = true, tagline = false }) => {
    const line = ink === 'light' ? 'text-white' : 'text-slate-950';

    if (!showWordmark) {
        return <LogoMark size={size} ink={ink} className={className} />;
    }

    return (
        <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
            <LogoMark size={size} ink={ink} />
            <div className="leading-[0.94]">
                <p className={`text-[13px] sm:text-[17px] font-black uppercase tracking-[0.01em] ${line}`}>
                    Algebra
                </p>
                <p className={`text-[13px] sm:text-[17px] font-black uppercase tracking-[0.01em] ${line}`}>
                    Assess
                </p>
                {tagline && (
                    <p
                        className={`mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] ${
                            ink === 'light' ? 'text-white/60' : 'text-slate-400'
                        }`}
                    >
                        AI Classroom Grading
                    </p>
                )}
            </div>
        </div>
    );
};

export default Logo;
