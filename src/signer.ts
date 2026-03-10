import { CompactSign } from 'jose';
import { DIDManager } from './did';

export class ActionSigner {
    private didManager: DIDManager;

    constructor(didManager: DIDManager) {
        this.didManager = didManager;
    }

    /**
     * Signs any arbitrary JSON payload and returns a JWS string.
     * @param payload The action data to sign.
     * @param aud The intended Audience (e.g., 'tool:slack', 'agent:coordinator'). Mandatory to prevent replay attacks.
     */
    public async signAction(payload: any, aud: string): Promise<string> {
        if (!this.didManager.did) {
            throw new Error("DID Manager not initialized. Call initialize() first.");
        }

        const privateKey = await this.didManager.getSignerKey();

        // Inject the required aud claim directly into the signed payload wrapper
        const securedPayload = {
            ...payload,
            aud: aud,
            iat: Math.floor(Date.now() / 1000) // Issued at timestamp
        };

        const payloadBytes = new TextEncoder().encode(JSON.stringify(securedPayload));

        const jws = await new CompactSign(payloadBytes)
            .setProtectedHeader({ alg: 'EdDSA', kid: this.didManager.did })
            .sign(privateKey);

        this.logAudit(securedPayload, jws);

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
