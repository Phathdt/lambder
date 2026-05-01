import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';

export interface JwtKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

// Fast EdDSA key generation for integration tests; do NOT reuse in production.
export async function generateTestJwtKeys(): Promise<JwtKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
  return {
    privateKeyPem: await exportPKCS8(privateKey),
    publicKeyPem: await exportSPKI(publicKey),
  };
}
