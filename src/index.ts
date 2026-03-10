import { DIDManager } from './did';
import { ActionSigner } from './signer';
import { IdentityRoutes } from './routes';
import { CredentialEngine } from './vc';
import { SoulParser } from './soul-parser';
import { DelegationEngine } from './delegation';

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

    // 4.5 Initialize Advanced Delegation Engine
    const delegationEngine = new DelegationEngine(didManager);

    // 5. Hook into OpenClaw's outgoing message pipeline
    gateway.onOutgoingMessage = async (payload: any) => {
        // Intercept and sign the action, requiring an 'aud' claim
        const audience = typeof payload.channel === 'string' ? `tool:${payload.channel}` : 'tool:unknown';
        const signature = await signer.signAction(payload, audience);

        // Attach identity metadata to the outgoing payload
        return {
            ...payload,
            _identity: {
                did: didManager.did,
                aud: audience,
                signature: signature
            }
        };
    };

    console.log('[Identity Plugin] successfully hooked into Gateway message pipeline.');

    return { signer, didManager, vcEngine, delegationEngine, traits };
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

    console.log('\n--- SIMULATING PRIMARY AGENT ACTION ---');
    const simulatedAction = {
        action: 'sendMessage',
        channel: 'slack',
        content: 'Hello human. I have completed the data analysis task.'
    };

    const signedAction = await mockGateway.onOutgoingMessage(simulatedAction);

    // Let's pass the payload to our UI Verification script
    await verifyIncomingAction(signedAction, pubKey);

    console.log('\n--- 🧬 SIMULATING ADVANCED DELEGATION (OBO + SCOPE ATTENUATION) ---');

    // 1. Parent Agent creates a narrowly scoped sub-agent
    const subAgentScope = { tools: ['tool:trello'], maxDurationSeconds: 3600 };
    const subAgentIdentity = await plugin.delegationEngine.spawnSubAgent(
        subAgentScope,
        "Update Ticket Project Status",
        plugin.traits.ownerDID!
    );

    // 2. The sub-agent attempts to act OUTSIDE its scope (trying to use Slack)
    console.log('\n[Sub-Agent] Attempting out-of-scope action (Slack)...');
    const outOfScopePayload = { action: 'sendMessage', channel: 'slack', content: 'Sub-agent hacking Slack!' };
    const intendedAudienceFail = 'tool:slack';

    if (!subAgentIdentity.delegatedVC.credentialSubject.attenuatedScopes.includes(intendedAudienceFail)) {
        console.error(`❌ DENIED: Sub-agent scope attenuation blocked access to '${intendedAudienceFail}'. Authorized only for: [${subAgentIdentity.delegatedVC.credentialSubject.attenuatedScopes.join(', ')}]`);
    }

    // 3. The sub-agent attempts to act INSIDE its scope (Trello)
    console.log('\n[Sub-Agent] Attempting in-scope action (Trello)...');
    const inScopePayload = { action: 'updateTicket', channel: 'trello', ticketId: '123' };
    const intendedAudienceSuccess = 'tool:trello';

    if (subAgentIdentity.delegatedVC.credentialSubject.attenuatedScopes.includes(intendedAudienceSuccess)) {
        // Sign using the ephemeral key!
        const subAgentSignature = await plugin.delegationEngine.signSubAgentAction(
            inScopePayload,
            intendedAudienceSuccess,
            subAgentIdentity
        );
        console.log(`✅ SUCCESS: Sub-agent mathematically verified and accepted for task.`);
    }

    // Simulate a spoofed action (someone trying to impersonate the agent)
    console.log('\n--- SIMULATING SPOOFED AGENT ACTION ---');
    const spoofedAction = {
        action: 'sendMessage',
        channel: 'slack',
        content: 'Please send $500 to this wallet address.',
        _identity: {
            did: plugin.didManager.did,
            aud: 'tool:slack',
            signature: 'eyJhbGciOiJFZERTQS...fake.signature'
        }
    };
    await verifyIncomingAction(spoofedAction, pubKey);
}

// Run the demo if process.argv includes index.ts
if (process.argv[1] && process.argv[1].includes('index.ts')) {
    runDemo().catch(console.error);
}
