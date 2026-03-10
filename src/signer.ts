import { CompactSign } from 'jose';
import { DIDManager } from './did';

export class ActionSigner {
    private didManager: DIDManager;

    constructor(didManager: DIDManager) {
        this.didManager = didManager;
    }

    /**
     * Signs any arbitrary JSON payload and returns a JWS string.
     */
    public async signAction(payload: any): Promise<string> {
        if (!this.didManager.did) {
            throw new Error("DID Manager not initialized. Call initialize() first.");
        }

        const privateKey = await this.didManager.getSignerKey();
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

        const jws = await new CompactSign(payloadBytes)
            .setProtectedHeader({ alg: 'EdDSA', kid: this.didManager.did })
            .sign(privateKey);

        this.logAudit(payload, jws);

        return jws;
    }

    private logAudit(payload: any, signature: string) {
        // In a real plugin, this writes to a secure rotating log file.
        // For MVP, we log to stdout to demonstrate the verifiable audit trail.
        console.log(`\n--- [SECURITY AUDIT TRAIL] ---`);
        console.log(`[AGENT DID] ${this.didManager.did}`);
        console.log(`[ACTION PAYLOAD] ${JSON.stringify(payload)}`);
        console.log(`[CRYPTOGRAPHIC SIGNATURE] ${signature}`);
        console.log(`------------------------------\n`);
    }
}
