1. Threat Model
Threat	Description	Mitigation
Unauthorized access	Attackers attempt to access endpoints without valid credentials	JWT authentication, role-based access control (RBAC), ownership guards
Horizontal privilege escalation	Users trying to perform actions of peers	Ownership guards, strict role checks, query-level filters
Replay attacks	Re-submitting old requests (esp. smart contract calls)	Nonce-based replay protection, Soroban transaction checks
Data exfiltration	Sensitive data leakage	HTTPS/TLS, encrypted secrets, environment separation
Fraudulent operations	Users attempting to manipulate bets or transactions	Backend validation, Oracle verification, smart contract authorization
2. Backend Security
2.1 JWT Authentication

All API endpoints require JWT tokens unless explicitly public.

Token properties:

exp (expiry)

sub (user ID)

roles (array of roles)

Tokens are signed with a 32+ character secret stored securely in production.

Mitigation: Prevents unauthorized API calls and enforces session expiry.

2.2 Ownership Guards

Enforce per-resource ownership:

if (resource.userId !== request.user.id) throw new ForbiddenError();

Ensures users can only modify or view their own resources.

Mitigation: Prevents horizontal privilege escalation.

2.3 Role-Based Access Control (RBAC)

Roles:

USER — basic functionality

ADMIN — system management

ORACLE — settlement verification

Decorators or middleware check roles for sensitive endpoints:

@Roles('ADMIN') 
@UseGuards(RoleGuard)

Fine-grained endpoint restrictions prevent misuse.

2.4 Rate Limiting

Prevents brute-force and DOS attacks.

Example using express-rate-limit:

const limiter = rateLimit({
  windowMs: 60_000,
  max: 100, // per IP per minute
});
app.use(limiter);
2.5 Fraud Detection

Server-side validations:

Bet amounts and user balances

Oracle-signed settlements

Duplicate or invalid requests flagged

Logs suspicious activity for manual review.

3. Smart Contract Security
3.1 Authorization

Only specific keys (Admin / Oracle) can call sensitive contract functions.

Smart contracts verify msg.sender or signed authorization.

3.2 Replay Protection

Transactions include unique nonce per user.

Soroban contracts reject duplicate nonces.

3.3 Trust Boundaries

Backend orchestrates user-facing requests; smart contracts enforce final settlement.

Backend cannot modify blockchain state outside authorized calls.

Only Admin-controlled keys can upgrade contracts (upgradeable contracts are versioned).

4. Horizontal Privilege Escalation Mitigation

All requests include user context.

Query filters always enforce userId = requester.id.

Admins cannot act as users unless explicitly impersonating with audit logs.

5. Sensitive Data Handling

Never store secrets in git.

All secrets in production environment variables or secret managers.

Database fields like passwords are hashed (bcrypt) with salts.

6. Production Safety Recommendations

HTTPS only

CSP, CORS, and Helmet enabled

Logging and alerting for suspicious events

Periodic key rotation for JWT, Admin, and Oracle keys

7. References

JWT Best Practices

Soroban Security Guide

OWASP Top 10 for APIs