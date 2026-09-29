import type { ReactElement, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const make = (children: ReactElement | ReactElement[], extra: Partial<P> = {}) => (props: P) => <svg {...base} {...extra} {...props}>{children}</svg>;

export const IconBack = make(<path d="m15 18-6-6 6-6" />);
export const IconChevron = make(<path d="m9 18 6-6-6-6" />);
export const IconMore = make([<circle key="a" cx="12" cy="5" r="1" />, <circle key="b" cx="12" cy="12" r="1" />, <circle key="c" cx="12" cy="19" r="1" />]);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconClose = make(<path d="M18 6 6 18M6 6l12 12" />);
export const IconX = make(<path d="M18 6 6 18M6 6l12 12" />, { strokeWidth: 2.5 });
export const IconCheck = make(<path d="M20 6 9 17l-5-5" />, { strokeWidth: 3 });
export const IconPlay = make(<path d="M7 5v14l11-7z" />);
export const IconSearch = make([<circle key="a" cx="11" cy="11" r="7" />, <path key="b" d="m20 20-3.5-3.5" />]);
export const IconSliders = make([
  <path key="a" d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />, <circle key="b" cx="16" cy="6" r="2" />,
  <circle key="c" cx="10" cy="12" r="2" />, <circle key="d" cx="18" cy="18" r="2" />,
]);
export const IconGrip = make(<path d="M4 9h16M4 15h16" />);
export const IconMedal = make([<circle key="a" cx="12" cy="9" r="6" />, <path key="b" d="m8.2 13.8-1.7 7.2L12 18l5.5 3-1.7-7.2" />]);
export const IconCalendar = make([<rect key="a" x="3" y="5" width="18" height="16" rx="2" />, <path key="b" d="M3 10h18M8 3v4M16 3v4" />]);
export const IconImage = make([<rect key="a" x="3" y="4" width="18" height="16" rx="2" />, <circle key="b" cx="9" cy="10" r="2" />, <path key="c" d="m21 16-5-5-9 9" />], { strokeWidth: 1.6 });
export const IconPhone = make([<rect key="a" x="6" y="2" width="12" height="20" rx="2" />, <path key="b" d="M11 18h2" />]);
export const IconExternal = make(<path d="M7 17 17 7M8 7h9v9" />);
export const IconHome = make(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />);
export const IconHistory = make([<circle key="a" cx="12" cy="12" r="9" />, <path key="b" d="M12 7v5l3 2" />]);
export const IconLift = make(<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />);
export const IconList = make(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />);
export const IconUser = make([<circle key="a" cx="12" cy="8" r="4" />, <path key="b" d="M4 21a8 8 0 0 1 16 0" />]);
