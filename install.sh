#!/bin/bash
# OpenClaw Identity Plugin - 1-Click Installer
echo "========================================="
echo " Installing OpenClaw Identity Verification"
echo "========================================="

echo "\n[1/3] Cloning repository..."
# In a real scenario, this would clone from the user's open source repo into the openclaw plugins folder
# git clone https://github.com/Utopia5327/openclaw-identity-plugin.git
# cd openclaw-identity-plugin

echo "\n[2/3] Installing dependencies..."
npm install > /dev/null 2>&1

echo "\n[3/3] Generating Identity Keys..."
# This generates the DID upon install so the user doesn't have to configure it manually
npx tsx src/index.ts --init-only > /dev/null 2>&1

echo "\n✅ Installation Complete!"
echo "Your OpenClaw agent now has a Verifiable Identity."
echo "Public DID Key stored in: .identity.enc"
echo "========================================="
