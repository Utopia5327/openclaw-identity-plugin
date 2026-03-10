import { compactVerify, importJWK } from 'jose';

// This script acts as the "Client UI" (e.g., Discord, Slack, or a Web Dashboard)
// It receives a signed payload from OpenClaw and verifies it against the Agent's Public Key.
export async function verifyIncomingAction(signedPayload: any, agentPublicKeyJWK: any) {
    console.log('\n--- CLIENT RECEIVED MESSAGE ---');
    console.log(`Raw Message Payload: ${JSON.stringify(signedPayload)}`);

    if (!signedPayload._identity || !signedPayload._identity.signature) {
        console.warn(`[WARNING] Message is UNSIGNED. Potential spoofing attempt.`);
        return false;
    }

    try {
        const signature = signedPayload._identity.signature;
        const publicKey = await importJWK(agentPublicKeyJWK, 'EdDSA');

        // Cryptographically verify the JWS
        const { payload, protectedHeader } = await compactVerify(signature, publicKey);

        console.log(`\n✅ [VERIFIED BADGE]`);
        console.log(`Identity: ${protectedHeader.kid}`);
        console.log(`Verified Content: ${new TextDecoder().decode(payload)}`);
        return true;
    } catch (e: any) {
        console.error(`\n❌ [SECURITY ALERT] Signature Verification FAILED!`);
        console.error(`Reason: ${e.message}`);
        return false;
    }
}
