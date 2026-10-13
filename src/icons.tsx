import React from 'react';
const paths: Record<string, React.ReactNode> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  back: <path d="m14 5-7 7 7 7" />,
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  map: (
    <>
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16" />
    </>
  ),
  book: (
    <>
      <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V7l8-4 8 4v14M2 21h20M8 9v2m8-2v2m-8 3v2m8-2v2m-5 5v-5h2v5" />
    </>
  ),
  flask: (
    <>
      <path d="M8 3h8m-6 0v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C8 2 1 8 5 16s15 5 15-13ZM4 21 15 10" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 5" />
    </>
  ),
  gate: (
    <>
      <path d="M4 21V4h16v17M8 21V8h8v13M2 21h20" />
    </>
  ),
  heart: <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 8 15 8 15S25 10 20 5Z" />,
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18Z" />
    </>
  ),
  walk: (
    <>
      <circle cx="14" cy="4" r="2" />
      <path d="m7 21 4-8 3 3v5M4 12l5-4 5 1 3 4h4M11 8l-1 6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  qr: (
    <>
      <path d="M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0h3v3h3v3h-6Zm6-3v3m-9-3v3M3 12h6m3-9v6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  layers: (
    <>
      <path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v7m0-11v1" />
    </>
  ),
  wheelchair: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m12 8-1 6h6l3 6h2M12 10h6M8 10a6 6 0 1 0 7 9" />
    </>
  ),
  route: (
    <>
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h6" />
    </>
  ),
  edit: (
    <>
      <path d="m4 16-1 5 5-1L20 8l-4-4ZM13 7l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
    </>
  ),
  swap: (
    <>
      <path d="M8 3v17m-4-4 4 4 4-4M16 21V4m-4 4 4-4 4 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1" />
    </>
  ),
  link: (
    <>
      <path d="m9 15 6-6m-6 1-2-2-4 4a4 4 0 0 0 6 6l3-3m0-6 3-3a4 4 0 0 1 6 6l-4 4-2-2" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  ...rest
}: {
  name: string;
  size?: number;
  [key: string]: any;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name] || paths.pin}
    </svg>
  );
}
