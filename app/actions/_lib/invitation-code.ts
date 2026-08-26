import 'server-only';

const INVITATION_CODE_LENGTH = 6;
const INVITATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateInvitationCode = (): string => {
  const bytes = new Uint8Array(INVITATION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => INVITATION_CODE_ALPHABET[b % INVITATION_CODE_ALPHABET.length],
  ).join('');
};
