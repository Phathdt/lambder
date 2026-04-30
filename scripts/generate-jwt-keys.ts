import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
const privPem = await exportPKCS8(privateKey);
const pubPem = await exportSPKI(publicKey);

const out = join(process.cwd(), '.env.keys');
const content = [
  `JWT_PRIVATE_KEY_PEM="${privPem.replace(/\n/g, '\\n')}"`,
  `JWT_PUBLIC_KEY_PEM="${pubPem.replace(/\n/g, '\\n')}"`,
  '',
].join('\n');

await writeFile(out, content);
console.log(`Wrote keys to ${out}`);
console.log('Append the contents to your .env or copy to AWS SSM Parameter Store.');
