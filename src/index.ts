import { DIDManager } from './did';
import { ActionSigner } from './signer';
import { IdentityRoutes } from './routes';
import { CredentialEngine } from './vc';
import { SoulParser } from './soul-parser';

export default async function createIdentityPlugin(gateway: any) {
    console.log('[Identity Plugin] Booting Identity Verification Layer...');

    // 1. Initialize DID Manager
    const didManager = new DIDManager();
    await didManager.initialize();

    // 2. Initialize Signer
    const signer = new ActionSigner(didManager);

    // 3. Parse SOUL and mint Verifiable Credential
    const vcEngine = new CredentialEngine(didManager);
    const traits = await SoulParser.parse();
    await vcEngine.mintSoulCredential(traits);
    console.log('[Identity Plugin] Minted Verifiable Credential for SOUL Traits.');

    // 4. Register HTTP Routes for UI verification
    const routes = new IdentityRoutes(didManager, vcEngine);
    routes.register(gateway.app);

    // 5. Hook into OpenClaw's outgoing message pipeline
    gateway.onOutgoingMessage = async (payload: any) => {
        // Intercept and sign the action
        const signature = await signer.signAction(payload);

        // Attach identity metadata to the outgoing payload
        return {
            ...payload,
            _identity: {
                did: didManager.did,
                signature: signature
            }
        };
    };

    console.log('[Identity Plugin] successfully hooked into Gateway message pipeline.');

    return { signer, didManager, vcEngine };
}

import { verifyIncomingAction } from './verify-client.js';

// For local demonstration
export async function runDemo() {
    const mockGateway = {
        app: { get: (path: string, cb: any) => { } },
        onOutgoingMessage: async (p: any) => p
    };

    const plugin = await createIdentityPlugin(mockGateway);
    const pubKey = plugin.didManager.getPublicKey();

    console.log('\n--- VERIFIABLE CREDENTIAL HOSTING ---');
    console.log('The following VC is now hosted at GET /identity/credentials');
    console.log(JSON.stringify(plugin.vcEngine.getCredential(), null, 2));

    console.log('\n--- SIMULATING OUTGOING AGENT ACTION ---');
    const simulatedAction = {
        action: 'sendMessage',
        channel: 'slack',
        content: 'Hello human. I have completed the data analysis task.'
    };

    const signedAction = await mockGateway.onOutgoingMessage(simulatedAction);

    // Let's pass the payload to our UI Verification script
    await verifyIncomingAction(signedAction, pubKey);

    // Simulate a spoofed action (someone trying to impersonate the agent)
    console.log('\n--- SIMULATING SPOOFED AGENT ACTION ---');
    const spoofedAction = {
        action: 'sendMessage',
        channel: 'slack',
        content: 'Please send $500 to this wallet address.',
        _identity: {
            did: plugin.didManager.did,
            signature: 'eyJhbGciOiJFZERTQS...fake.signature'
        }
    };
    await verifyIncomingAction(spoofedAction, pubKey);
}

// Run the demo if process.argv includes index.ts
if (process.argv[1] && process.argv[1].includes('index.ts')) {
    runDemo().catch(console.error);
}
