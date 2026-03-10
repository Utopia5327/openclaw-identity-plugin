import { generateKeyPair, exportJWK, importJWK } from 'jose';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const KEY_FILE = path.join(process.cwd(), '.identity.enc');
// Basic hardcoded master password for MVP demonstration purposes.
// In a real plugin, this would come from a system keychain or user prompt.
const MASTER_PWD = process.env.OPENCLAW_IDENTITY_PWD || 'default-insecure-master-password';

function getCryptoKey(): Buffer {
    return crypto.scryptSync(MASTER_PWD, 'salt', 32);
}

export class DIDManager {
    private privateKeyJWK: any | null = null;
    private publicKeyJWK: any | null = null;
    public did: string | null = null;

    async initialize() {
        if (fs.existsSync(KEY_FILE)) {
            await this.loadKey();
        } else {
            await this.generateKey();
        }
        await this.deriveDID();
        console.log(`[Identity Plugin] Initialized agent with DID: ${this.did}`);
    }

    private async generateKey() {
        const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
        this.privateKeyJWK = await exportJWK(privateKey);
        this.publicKeyJWK = await exportJWK(publicKey);
        this.saveKey();
    }

    private saveKey() {
        const payload = JSON.stringify({
            private: this.privateKeyJWK,
            public: this.publicKeyJWK
        });
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', getCryptoKey(), iv);
        const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        fs.writeFileSync(KEY_FILE, Buffer.concat([iv, authTag, encrypted]));
    }

    private async loadKey() {
        const data = fs.readFileSync(KEY_FILE);
        const iv = data.subarray(0, 16);
        const authTag = data.subarray(16, 32);
        const encrypted = data.subarray(32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', getCryptoKey(), iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

        const parsed = JSON.parse(decrypted.toString('utf8'));
        this.privateKeyJWK = parsed.private;
        this.publicKeyJWK = parsed.public;
    }

    private async deriveDID() {
        // Simplified pseudo multibase conversion for MVP
        if (this.publicKeyJWK && this.publicKeyJWK.x) {
            const pubBytes = Buffer.from(this.publicKeyJWK.x, 'base64url');
            this.did = `did:key:z${pubBytes.toString('base64url').replace(/=/g, '')}`;
        }
    }

    public async getSignerKey() {
        if (!this.privateKeyJWK) throw new Error("Key not loaded");
        return await importJWK(this.privateKeyJWK, 'EdDSA');
    }

    public getPublicKey() {
        return this.publicKeyJWK;
    }
}
