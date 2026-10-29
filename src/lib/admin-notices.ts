// Avisos que se muestran después de guardar. Viajan en la dirección (?aviso=codigo) y solo se muestra
// el texto de un código conocido: nunca texto que venga de la dirección.
export const ADMIN_NOTICE_PARAM = 'aviso';

export const ADMIN_NOTICES = {
  'producto-guardado': 'Listo, guardamos el producto.',
  'foto-guardada': 'Listo, guardamos la foto.',
  'foto-quitada': 'Quitamos la foto.',
  publicado: 'El producto ya se ve en la tienda.',
  oculto: 'Ocultamos el producto. Ya no se ve en la tienda.',
  eliminado: 'Eliminamos el producto. Si te arrepentís, lo podés recuperar desde «Ocultar o mostrar».',
  recuperado: 'Recuperamos el producto como borrador.',
  'cambios-guardados': 'Guardamos los cambios.',
} as const;

export type AdminNoticeCode = keyof typeof ADMIN_NOTICES;

export function noticeFor(code: string | null | undefined): string | null {
  return code && Object.hasOwn(ADMIN_NOTICES, code) ? ADMIN_NOTICES[code as AdminNoticeCode] : null;
}

export function withNotice(path: string, code: AdminNoticeCode, anchor?: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${ADMIN_NOTICE_PARAM}=${code}${anchor ? `#${anchor}` : ''}`;
}
