# OpenClaw Identity Verification Plugin

An open-source plugin for the [OpenClaw](https://openclaw.ai/) autonomous AI agent framework that provides a standardized, cryptographic identity verification layer. 

This plugin solves the "trust and accountability" gap for autonomous agents by assigning them explicit identities, bound by verifiable boundaries, and capable of cryptographically signing their actions.

## Why Build This?

*   **Solve the Audit Trail Problem:** Standard agents share API keys, meaning audit logs look like the human user took the action. With this plugin, every API call can be cryptographically traced back to the specific AI agent instance.
*   **Prevent Impersonation:** Just because an agent says `{"agent_id": 123}` doesn't mean it's actually them. This natively enforces JSON Web Signatures (JWS) for non-repudiation.
*   **Advanced Delegation (OBO):** Support for On-Behalf-Of token exchanges. A primary agent can spawn an ephemeral sub-agent and issue it a mathematically linked Verifiable Credential.
*   **Strict Scope Attenuation:** When delegating tasks to sub-agents, the primary agent restricts the sub-agent's authorization to a tiny slice of tools (e.g., `["tool:slack", "tool:jira"]`). Out-of-scope tasks are cryptographically denied.
*   **Audience (`aud`) Strictness:** Payload signatures define explicit audiences, preventing an attacker from observing a signed Slack action and successfully replaying it against a Github endpoint.

## Overview
As autonomous agents execute workflows on our behalf, humans need an auditable trail of *who* did *what*. This plugin extends OpenClaw's Persona (`SOUL.md`) with three core pillars:

1. **Decentralized Identifier (DID):** Automatically generates and manages a secure `did:key` (Ed25519) giving the agent a true cryptographic identity.
2. **SOUL Credential Engine:** Parses your agent's `SOUL.md` (Core Truths, Boundaries, Vibe) and mints a W3C Verifiable Credential. Crucially, it links the agent to an `ownerDID` for ethical accountability.
3. **Action Signer:** Hooks into the OpenClaw Gateway. Every outgoing message or tool execution is cryptographically signed (JWS) using the agent's private key.

## Installation & Setup

**Option 1: Quick Install (Recommended)**
Run the automated installation script inside your OpenClaw plugins directory:
```bash
bash install.sh
```

**Option 2: Manual Install**
1. Clone the repository into your OpenClaw plugins directory.
```bash
npm install
```

2. (Optional) Provide an owner DID if you have one, or configure the master password in your `.env`:
```env
OPENCLAW_IDENTITY_PWD=your-secure-password
OPENCLAW_OWNER_DID=did:web:yourdomain.com
```

3. Start the plugin testing demonstration:
```bash
npm run start
```

## How It Works

### 1. Identity Verification Route
The plugin exposes two new endpoints on the OpenClaw Gateway:
* `GET /identity/status`: Returns the agent's DID, public key, and active status.
* `GET /identity/credentials`: Returns the W3C Verifiable Credential embedding the agent's `SOUL.md` traits.

### 2. Client-Side Verification (The "Verified Badge")
Any client UI (Chat app, dashboard) interacting with OpenClaw can verify the signed payloads. If the payload signature matches the agent's public key from `/identity/status`, the client can confidently render a "Verified Agent" badge.

See `src/verify-client.ts` for a reference implementation of how a client verifies an incoming agent action.

---
*Built as a concept for the OpenClaw ecosystem.*
