import { DIDManager } from './did';
import { SOULTraits } from './soul-parser';
import { CompactSign } from 'jose';

export class CredentialEngine {
    private didManager: DIDManager;
    private cachedVC: any = null;

    constructor(didManager: DIDManager) {
        this.didManager = didManager;
    }

    /**
     * Mints a W3C-style Verifiable Credential asserting the agent's Soul traits
     */
    public async mintSoulCredential(traits: SOULTraits): Promise<any> {
        if (!this.didManager.did) throw new Error("DID not initialized");

        // The Verifiable Credential Payload
        const vcPayload = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://w3id.org/security/suites/ed25519-2020/v1"
            ],
            type: ["VerifiableCredential", "IdentityCredential"],
            issuer: traits.ownerDID, // The human owner is the issuer of this identity
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
                id: this.didManager.did,
                agentType: "Autonomous AI", // Ethical trait marking it as non-human
                traits: {
                    coreTruths: traits.coreTruths,
                    boundaries: traits.boundaries,
                    vibe: traits.vibe
                }
            }
        };

        console.warn(`[VC Engine] NOTE: In a real environment, the SOUL VC would be cryptographically signed by the owner (${traits.ownerDID}), not just self-signed.`);

        const privateKey = await this.didManager.getSignerKey();
        const payloadBytes = new TextEncoder().encode(JSON.stringify(vcPayload));

        const signature = await new CompactSign(payloadBytes)
            .setProtectedHeader({ alg: 'EdDSA', kid: this.didManager.did })
            .sign(privateKey);

        this.cachedVC = {
            ...vcPayload,
            proof: {
                type: "Ed25519Signature2020",
                created: new Date().toISOString(),
                proofPurpose: "assertionMethod",
                verificationMethod: `${this.didManager.did}#keys-1`,
                jws: signature
            }
        };

        return this.cachedVC;
    }

    public getCredential() {
        return this.cachedVC;
    }
}
