import { DIDManager } from './did';
import { CredentialEngine } from './vc';

export class IdentityRoutes {
    private didManager: DIDManager;
    private vcEngine: CredentialEngine;

    constructor(didManager: DIDManager, vcEngine: CredentialEngine) {
        this.didManager = didManager;
        this.vcEngine = vcEngine;
    }

    public getStatus(req: any, res: any) {
        res.json({
            did: this.didManager.did,
            publicKey: this.didManager.getPublicKey(),
            verified: true,
            status: 'active'
        });
    }

    public getCredentials(req: any, res: any) {
        res.json({
            credentials: [this.vcEngine.getCredential()]
        });
    }

    public register(app: any) {
        // Assume 'app' is an Express-like router provided by OpenClaw Gateway
        if (app && app.get) {
            app.get('/identity/status', (req: any, res: any) => this.getStatus(req, res));
            app.get('/identity/credentials', (req: any, res: any) => this.getCredentials(req, res));
            console.log('[Identity Plugin] Registered Gateway HTTP Route: GET /identity/status');
            console.log('[Identity Plugin] Registered Gateway HTTP Route: GET /identity/credentials');
        }
    }
}
