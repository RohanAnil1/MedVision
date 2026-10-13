import { toUnicode } from 'punycode'
// Cornerstone's DICOM XML dependency only uses these Node URL helpers.
export function domainToASCII(domain: string): string {
  try {return new URL(`http://${domain}`).hostname} catch {return ''}
}
export function domainToUnicode(domain: string): string {return toUnicode(domainToASCII(domain))}
