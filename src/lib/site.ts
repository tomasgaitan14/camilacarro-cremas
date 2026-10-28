export const STORE = {
  name: 'Camila Carro',
  tagline: 'Estética y cuidado personal',
  city: 'Gualeguaychú, Entre Ríos',
  instagramUrl: 'https://www.instagram.com/camilacarro.estetica/',
  instagramHandle: '@camilacarro.estetica',
  logoUrl: '/brand/logo-camila-carro.webp',
} as const;

// Navegación principal. `match` decide cuándo el enlace se marca como activo.
export const NAV_ITEMS = [
  { label: 'Inicio', href: '/', match: (path: string) => path === '/' },
  { label: 'Productos', href: '/productos', match: (path: string) => path.startsWith('/productos') },
  { label: 'Rutinas', href: '/rutinas', match: (path: string) => path.startsWith('/rutinas') },
  { label: 'Cómo comprar', href: '/#como-comprar', match: () => false },
] as const;

// Rutina orientativa de ejemplo (no es una recomendación de productos ni de activos)
export const ROUTINE_SCHEDULE = {
  morning: [
    { label: 'Limpieza', note: null },
    { label: 'Tratamiento', note: 'Cuando corresponda' },
    { label: 'Hidratación', note: null },
    { label: 'Protección solar', note: null },
  ],
  night: [
    { label: 'Limpieza', note: null },
    { label: 'Tratamiento', note: 'Según tus necesidades y los productos que uses' },
    { label: 'Hidratación', note: null },
  ],
} as const;
