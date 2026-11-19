# Autonomous Agent Rules for GOODYGUYS

These rules apply to all AI agents working on this workspace and take precedence during execution.

## 1. Autonomous Skill & Package Security Scanning
Whenever the user asks to download, clone, install, or import any external skill, plugin, MCP tool, script, or npm package:
- You **MUST automatically invoke the `skill-security-scanner` skill** before registering, installing, or executing it.
- Inspect the repository for hardcoded secrets, obfuscated shell commands, arbitrary network calls, or unsafe script injections.
- Provide a clear security verdict (🟢 Safe, 🟡 Warning, 🔴 Critical/Blocked) to the user.
- Never install or execute any package that fails the security check.

## 2. Web Creation Playbook Execution
Whenever designing, scaffolding, or adding major features to the website:
- Automatically follow the 6-Phase Lifecycle defined in `web-creation-playbook`.
- Enforce the 35-Item Pre-Launch Vulnerability & Compliance Checklist (`e:\goodyguys\docs\pre_launch_35_checklist.md`).
- Run `npx -y modern-web-guidance@latest legacy-scan .` to guarantee 0 modern web deprecations.
