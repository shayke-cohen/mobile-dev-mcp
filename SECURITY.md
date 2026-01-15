# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Design

Mobile Dev MCP is designed with security as a core principle:

### Debug-Only Operation
- All SDKs are **only active in DEBUG/development builds**
- SDK code is completely excluded from production/release builds
- No runtime performance impact in production

### Local-Only Communication
- All communication happens via **localhost WebSocket**
- No external network calls or data transmission
- No telemetry, analytics, or data collection

### No Sensitive Data Storage
- SDKs do not persist any data
- No credentials or secrets are stored
- State exposure is explicitly opt-in by developers

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue**
2. Email security concerns to: [security@mobile-dev-mcp.com](mailto:security@mobile-dev-mcp.com)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release

### Scope

In scope:
- MCP server vulnerabilities
- SDK security issues
- Authentication/authorization bypasses
- Data exposure risks

Out of scope:
- Issues in demo applications only
- Social engineering attacks
- Physical security attacks
- Issues requiring physical access to device

## Security Best Practices

When using Mobile Dev MCP:

1. **Never enable in production** - Ensure DEBUG checks are in place
2. **Review exposed state** - Only expose non-sensitive data
3. **Validate action handlers** - Sanitize inputs in registered actions
4. **Use latest versions** - Keep SDKs updated

## Acknowledgments

We appreciate security researchers who help keep Mobile Dev MCP secure. Contributors will be acknowledged here (with permission).
