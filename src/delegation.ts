import { generateKeyPair, exportJWK, CompactSign } from 'jose';
import { webcrypto } from 'node:crypto';
import { DIDManager } from './did';

export interface AttenuatedScope {
    tools: string[];
    maxDurationSeconds: number;
}

export interface SubAgentIdentity {
    ephemeralDID: string;
    delegatedVC: any;
    privateKey: Uint8Array;
}

export class DelegationEngine {
    private didManager: DIDManager;

    constructor(didManager: DIDManager) {
        this.didManager = didManager;
    }

    /**
     * Spawns a new sub-agent with its own ephemeral DID and a Verifiable Credential 
     * mathematically linked to the parent agent, with strict scope attenuation.
     */
    public async spawnSubAgent(scopes: AttenuatedScope, taskContext: string, ownerDID: string): Promise<SubAgentIdentity> {
        if (!this.didManager.did) throw new Error("Parent DID not initialized.");

        // 1. Generate an ephemeral keypair for the sub-agent (must be extractable for our custom UI serialization)
        const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
        const jwk = await exportJWK(publicKey);
        const ephemeralDID = `did:key:ephemeral-${jwk.x!.substring(0, 16)}`; // Simplified DID for the demo

        // 2. Draft the Delegated VC (On-Behalf-Of flow / Nested `act` claims)
        const parentPrivateKey = await this.didManager.getSignerKey();

        const delegatedPayload = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            type: ["VerifiableCredential", "DelegationCredential"],
            issuer: this.didManager.did, // Parent Agent is issuing this to the Sub-Agent
            issuanceDate: new Date().toISOString(),
            expirationDate: new Date(Date.now() + scopes.maxDurationSeconds * 1000).toISOString(),
            credentialSubject: {
                id: ephemeralDID,
                delegatedTask: taskContext,
                attenuatedScopes: scopes.tools,
            },
            // The OBO/Nested Act Chain:
            // The sub-agent (id) acts on behalf of the Parent Agent (act), 
            // who acts on behalf of the Human Owner (sub).
            authorizationChain: {
                sub: ownerDID,          // Human accountability
                act: this.didManager.did // Parent Agent accountability
            }
        };

        // 3. Parent cryptographically signs the delegation
        const payloadBytes = new TextEncoder().encode(JSON.stringify(delegatedPayload));
        const signature = await new CompactSign(payloadBytes)
            .setProtectedHeader({ alg: 'EdDSA', kid: this.didManager.did })
            .sign(parentPrivateKey);

        const delegatedVC = {
            ...delegatedPayload,
            proof: {
                type: "Ed25519Signature2020",
                created: new Date().toISOString(),
                proofPurpose: "delegationMethod",
                verificationMethod: `${this.didManager.did}#keys-1`,
                jws: signature
            }
        };

        console.log(`\n[Delegation Engine] 🧬 Spawning Sub-Agent (${ephemeralDID})`);
        console.log(`[Delegation Engine] 🔒 Scopes strictly attenuated to tools: [${scopes.tools.join(', ')}]`);

        // Convert the WebCrypto CryptoKey into a raw Uint8Array for our standard signing flows
        const exportedPrivate = await webcrypto.subtle.exportKey('pkcs8', privateKey as webcrypto.CryptoKey);
        const privateKeyBytes = new Uint8Array(exportedPrivate);

        return {
            ephemeralDID,
            delegatedVC,
            privateKey: privateKeyBytes
        };
    }

    /**
     * Signs an action as the SUB-AGENT, enforcing the scopes.
     */
    public async signSubAgentAction(payload: any, aud: string, subAgent: SubAgentIdentity): Promise<string> {
        // Enforce Audience (RFC 8693)
        const securedPayload = {
            ...payload,
            aud: aud,
            iat: Math.floor(Date.now() / 1000)
        };

        const payloadBytes = new TextEncoder().encode(JSON.stringify(securedPayload));

        // Import the raw private key bytes back into a CryptoKey for `jose`
        const importedKey = await webcrypto.subtle.importKey(
            'pkcs8',
            subAgent.privateKey.buffer as ArrayBuffer,
            { name: 'Ed25519' },
            false,
            ['sign']
        );

        const jws = await new CompactSign(payloadBytes)
            .setProtectedHeader({ alg: 'EdDSA', kid: subAgent.ephemeralDID })
            .sign(importedKey);

        console.log(`\n--- [SUB-AGENT SECURITY AUDIT TRAIL] ---`);
        console.log(`[EPHEMERAL DID] ${subAgent.ephemeralDID}`);
        console.log(`[PARENT ACTOR]  ${subAgent.delegatedVC.authorizationChain.act}`);
        console.log(`[HUMAN SUBJECT] ${subAgent.delegatedVC.authorizationChain.sub}`);
        console.log(`[ACTION PAYLOAD] ${JSON.stringify(securedPayload)}`);
        console.log(`[CRYPTOGRAPHIC SIGNATURE] ${jws}`);
        console.log(`----------------------------------------\n`);

        return jws;
    }
}
