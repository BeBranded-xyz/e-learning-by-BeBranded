# Testing Catalogue

Reference catalogue of every test and quality-check category this ruleset
knows about, with what each detects. It is **not** a rule file: the rule is
`core/testing.mdc`, which makes every category below mandatory by default and
defines the gates. Each project tracks its status per category in
`TEST_PLAN.md` (template in `templates/TEST_PLAN.md`).

Use this document to decide *what* a category covers; use the language and
platform rules to decide *which tool* implements it.

---

## 1. Static Analysis

Checks performed without executing the application.

- [ ] Compiler checks
- [ ] Syntax validation
- [ ] Type checking
- [ ] Linting
- [ ] Formatting checks
- [ ] Static code analysis
- [ ] Dead-code detection
- [ ] Unused dependency detection
- [ ] Circular dependency detection
- [ ] Secret scanning
- [ ] SAST (Static Application Security Testing)
- [ ] Dependency vulnerability scanning
- [ ] License compliance scanning

### Detects

- Syntax errors
- Type errors
- Invalid references
- Suspicious code
- Potential crashes
- Security vulnerabilities
- Leaked API keys/tokens
- Vulnerable dependencies

---

## 2. Unit Tests

Test individual functions, classes, hooks, utilities, or other isolated pieces of logic.

```text
calculatePrice()
validateEmail()
parseDate()
calculateTax()
```

- [ ] Happy-path tests
- [ ] Edge-case tests
- [ ] Boundary-value tests
- [ ] Negative tests
- [ ] Error/exception tests
- [ ] Parameterized tests
- [ ] Table-driven tests
- [ ] Mock-based tests
- [ ] Stub-based tests

### Detects

- Incorrect calculations
- Logic errors
- Edge cases
- Unexpected input handling
- Incorrect error handling

---

## 3. Property-Based Testing

Define properties that must always remain true and automatically generate inputs attempting to break them.

Example:

```text
decode(encode(x)) == x
```

- [ ] Randomized input generation
- [ ] Invariant testing
- [ ] Round-trip testing
- [ ] Input shrinking

### Detects

Edge cases developers did not explicitly think about.

---

## 4. Mutation Testing

Automatically introduce bugs into the source code.

Example:

```diff
- if (age >= 18)
+ if (age > 18)
```

Then verify that the test suite fails.

- [ ] Operator mutations
- [ ] Conditional mutations
- [ ] Return-value mutations
- [ ] Constant mutations

### Detects

Weak or ineffective tests.

---

## 5. Component / Module Tests

Test complete components or modules while external dependencies are mocked or isolated.

Example:

```text
BookingService
    ↓
Fake Database
Fake Stripe
Fake Email Provider
```

- [ ] Service tests
- [ ] UI component tests
- [ ] Module tests
- [ ] Business logic tests

### Detects

Problems caused by interactions between functions inside a component.

---

## 6. Integration Tests

Verify that multiple real components work together correctly.

Examples:

```text
API ↔ PostgreSQL
API ↔ Redis
API ↔ Stripe
Backend ↔ Authentication
Worker ↔ Queue
Service A ↔ Service B
```

- [ ] Database integration
- [ ] Cache integration
- [ ] Queue integration
- [ ] Storage integration
- [ ] Authentication integration
- [ ] Third-party API integration
- [ ] Microservice integration

---

## 7. API Tests

Test every API endpoint.

Example:

```text
GET    /users
POST   /users
PATCH  /users/:id
DELETE /users/:id
```

Test:

- [ ] HTTP status codes
- [ ] Response schemas
- [ ] Response values
- [ ] Headers
- [ ] Authentication
- [ ] Authorization
- [ ] Missing parameters
- [ ] Invalid parameters
- [ ] Invalid payloads
- [ ] Empty payloads
- [ ] Large payloads
- [ ] Duplicate requests
- [ ] Pagination
- [ ] Filtering
- [ ] Sorting
- [ ] Rate limits
- [ ] Timeouts
- [ ] Idempotency
- [ ] Concurrent requests
- [ ] Error responses

---

## 8. Contract Tests

Verify that two services agree on their interface.

Example:

```text
Frontend expects:

{
  "userId": "string",
  "name": "string"
}

Backend must return:

{
  "userId": "string",
  "name": "string"
}
```

- [ ] API schema validation
- [ ] Consumer-driven contract testing
- [ ] Backward compatibility
- [ ] Forward compatibility
- [ ] Event schema validation
- [ ] Version compatibility

### Detects

Breaking API changes between services.

---

## 9. End-to-End (E2E) Tests

Simulate complete real-user workflows.

Example:

```text
Open website
↓
Create account
↓
Verify email
↓
Login
↓
Add product
↓
Checkout
↓
Pay
↓
Confirmation
```

Critical flows to test:

- [ ] Registration
- [ ] Login
- [ ] Logout
- [ ] Password reset
- [ ] Onboarding
- [ ] Checkout
- [ ] Payment
- [ ] Subscription
- [ ] Cancellation
- [ ] Core product workflow
- [ ] Account deletion

Common tools:

- Playwright
- Cypress
- Selenium

---

## 10. UI / Frontend Tests

- [ ] Component rendering
- [ ] DOM behavior
- [ ] User interactions
- [ ] Form validation
- [ ] Buttons
- [ ] Modals
- [ ] Dropdowns
- [ ] Navigation
- [ ] Routing
- [ ] State management
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Keyboard interactions
- [ ] Touch interactions
- [ ] Responsive layouts
- [ ] Client-side rendering
- [ ] Server-side rendering
- [ ] Hydration

---

## 11. Visual Regression Testing

Compare screenshots against approved reference screenshots.

Detect:

- [ ] Layout changes
- [ ] Broken spacing
- [ ] Font changes
- [ ] Missing elements
- [ ] Incorrect colors
- [ ] Overflow
- [ ] Mobile layout bugs
- [ ] Responsive bugs
- [ ] Unexpected CSS changes

Example:

```text
Expected Screenshot
        ↓
Pixel / visual comparison
        ↓
Current Screenshot
```

---

## 12. Accessibility Testing

- [ ] WCAG compliance
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Focus management
- [ ] Focus order
- [ ] ARIA attributes
- [ ] Form labels
- [ ] Image alt text
- [ ] Color contrast
- [ ] Zoom
- [ ] Reduced motion
- [ ] Touch target sizes
- [ ] Semantic HTML

---

## 13. Regression Testing

Whenever a bug is discovered:

```text
Bug discovered
↓
Create test reproducing bug
↓
Fix bug
↓
Test passes
↓
Keep test permanently
```

- [ ] Every fixed bug receives a regression test
- [ ] Critical previous bugs remain covered
- [ ] Regression suite runs before releases

---

## 14. Smoke Tests

Fast tests checking whether the deployed application basically works.

- [ ] Website loads
- [ ] API responds
- [ ] Database connects
- [ ] User can log in
- [ ] Authentication works
- [ ] Main product flow works
- [ ] Critical external services respond

Run immediately after deployment.

---

## 15. Sanity Tests

Targeted tests after small changes.

Example:

```text
Password reset changed
        ↓
Test:
- Login
- Password reset
- Authentication
- Sessions
```

Useful when running the entire test suite would be unnecessary or expensive.

---

# Performance Testing

## 16. Load Testing

Test expected production traffic.

Example:

```text
5,000 concurrent users
```

Measure:

- [ ] Latency
- [ ] Throughput
- [ ] CPU
- [ ] Memory
- [ ] Database load
- [ ] Error rate

---

## 17. Stress Testing

Increase traffic until the system fails.

```text
10k users
↓
20k
↓
50k
↓
100k
↓
FAILURE
```

Determine:

- Maximum capacity
- Failure behavior
- Recovery behavior

---

## 18. Spike Testing

Simulate sudden traffic increases.

```text
500 users
↓
50,000 users
↓
500 users
```

Detects problems with:

- Autoscaling
- Databases
- Queues
- Caches
- Rate limiting

---

## 19. Soak / Endurance Testing

Run sustained traffic for hours or days.

Detects:

- Memory leaks
- Connection leaks
- Resource exhaustion
- Slow degradation
- Queue accumulation

---

## 20. Scalability Testing

Test whether adding resources actually increases capacity.

```text
1 server
↓
2 servers
↓
5 servers
↓
10 servers
```

---

# Reliability Testing

## 21. Failure Injection

Intentionally make dependencies fail.

Test:

- [ ] Database unavailable
- [ ] Redis unavailable
- [ ] API unavailable
- [ ] Third-party API returns 500
- [ ] DNS failure
- [ ] Network failure
- [ ] Slow network
- [ ] Disk full
- [ ] Queue unavailable
- [ ] Server restart

---

## 22. Timeout Testing

Test what happens when dependencies respond slowly.

```text
Normal API: 100 ms

Test:
1 second
5 seconds
30 seconds
Never responds
```

---

## 23. Retry Testing

Verify retries do not cause:

- [ ] Duplicate payments
- [ ] Duplicate emails
- [ ] Duplicate jobs
- [ ] Duplicate database records
- [ ] Retry storms

---

## 24. Failover Testing

Verify traffic can switch to backup infrastructure.

- [ ] Database replica failover
- [ ] Server failover
- [ ] Region failover
- [ ] DNS failover
- [ ] Storage failover

---

## 25. Recovery Testing

Verify the application recovers correctly after failure.

- [ ] Process restart
- [ ] Server restart
- [ ] Database restart
- [ ] Network restoration
- [ ] Queue restoration

---

## 26. Disaster Recovery Testing

Test catastrophic failures.

Examples:

```text
Entire database lost
Entire server cluster lost
Cloud region unavailable
Production data corrupted
```

Verify:

- [ ] Backups work
- [ ] Restore works
- [ ] Recovery procedures work
- [ ] RPO requirements
- [ ] RTO requirements

---

## 27. Chaos Engineering

Deliberately break infrastructure.

Examples:

```text
Kill server
Kill container
Restart Kubernetes pod
Add 2s latency
Drop network packets
Disconnect database
Break Redis
```

Verify the system remains usable or fails gracefully.

---

# Security Testing

## 28. SAST

Static Application Security Testing.

Analyze source code for security vulnerabilities.

---

## 29. DAST

Dynamic Application Security Testing.

Attack a running application looking for vulnerabilities.

---

## 30. Dependency Security Testing

- [ ] Known CVEs
- [ ] Vulnerable npm packages
- [ ] Vulnerable Python packages
- [ ] Vulnerable OS packages
- [ ] Outdated dependencies

---

## 31. Authentication Testing

Test:

- [ ] Brute-force protection
- [ ] Password policies
- [ ] Password reset
- [ ] MFA
- [ ] Session expiration
- [ ] Token expiration
- [ ] Token revocation
- [ ] Account lockout
- [ ] OAuth flows

---

## 32. Authorization Testing

Verify users cannot access resources they should not.

```text
User A
    ↓
tries accessing
    ↓
User B's resource
```

Test:

- [ ] IDOR
- [ ] BOLA
- [ ] Privilege escalation
- [ ] Role permissions
- [ ] Admin endpoints
- [ ] Tenant isolation

---

## 33. Injection Testing

- [ ] SQL injection
- [ ] NoSQL injection
- [ ] Command injection
- [ ] LDAP injection
- [ ] Template injection
- [ ] Header injection

---

## 34. Web Security Testing

- [ ] XSS
- [ ] CSRF
- [ ] SSRF
- [ ] CORS
- [ ] Open redirects
- [ ] Clickjacking
- [ ] Path traversal
- [ ] File upload attacks
- [ ] Security headers
- [ ] Cookie security

---

## 35. Secret Scanning

Detect:

- API keys
- Passwords
- Database credentials
- Private keys
- Access tokens
- Cloud credentials

---

## 36. Penetration Testing

Human security experts intentionally attempt to compromise the application.

---

# Advanced Bug Detection

## 37. Fuzz Testing

Send malformed, random, or unexpected inputs.

Examples:

```text
""
NULL
999999999999999999999999
emoji and surrogate pairs
<script>
../../../etc/passwd
10MB string
Random binary
Invalid UTF-8
```

Useful for discovering crashes and unexpected behavior.

---

## 38. Differential Testing

Send identical inputs through multiple implementations.

```text
Input
 ├── Implementation A → Result A
 └── Implementation B → Result B

Compare A vs B
```

Useful for:

- Rewrites
- Parsers
- Compilers
- Algorithms
- Database migrations

---

# Database Testing

## 39. Database Tests

Test:

- [ ] Constraints
- [ ] Foreign keys
- [ ] Unique constraints
- [ ] Transactions
- [ ] Rollbacks
- [ ] Data integrity
- [ ] Query correctness
- [ ] Indexes
- [ ] Large datasets
- [ ] Connection pooling
- [ ] Replication

---

## 40. Migration Testing

Every database migration should test:

```text
Old Schema
↓
Migration
↓
New Schema
```

Verify:

- [ ] Existing data survives
- [ ] New schema is correct
- [ ] Migration works with production-size data
- [ ] Rollback works
- [ ] Old application version compatibility

---

# Concurrency Testing

## 41. Race Condition Testing

Test simultaneous operations.

Example:

```text
Request A ─┐
           ├──> Same resource
Request B ─┘
```

Detect:

- [ ] Race conditions
- [ ] Lost updates
- [ ] Duplicate processing
- [ ] Inconsistent state

---

## 42. Deadlock Testing

Test multiple operations competing for locks/resources.

---

## 43. Idempotency Testing

Running an operation twice should not accidentally perform it twice.

Example:

```text
POST /payment
POST /payment

Expected:
1 payment

Not:
2 payments
```

Especially important for:

- Payments
- Orders
- Webhooks
- Emails
- Background jobs

---

# Compatibility Testing

## 44. Browser Testing

Test:

- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Edge

---

## 45. Device Testing

Test:

- [ ] Desktop
- [ ] Laptop
- [ ] Tablet
- [ ] Mobile
- [ ] Touch devices

---

## 46. Operating System Testing

Test:

- [ ] Windows
- [ ] macOS
- [ ] Linux
- [ ] iOS
- [ ] Android

---

## 47. Responsive Testing

Test common viewport sizes and unusual dimensions.

- [ ] Small mobile
- [ ] Large mobile
- [ ] Tablet
- [ ] Laptop
- [ ] Desktop
- [ ] Ultrawide

---

# Internationalization

## 48. Localization Testing

Test:

- [ ] English
- [ ] French
- [ ] Spanish
- [ ] Other supported languages

Verify:

- Text overflow
- Missing translations
- Encoding
- Unicode
- RTL layouts

---

## 49. Date / Time Testing

Test:

- [ ] Time zones
- [ ] DST changes
- [ ] Leap years
- [ ] Midnight
- [ ] Month boundaries
- [ ] Year boundaries
- [ ] Date formatting

---

## 50. Currency / Number Testing

Test:

```text
€1,000.50
1 000,50 €
$1,000.50
¥1,000
```

Verify:

- Currency conversion
- Decimal separators
- Rounding
- Floating-point behavior

---

# Deployment Testing

## 51. Installation Testing

Test fresh installations.

---

## 52. Upgrade Testing

Test:

```text
v1 → v2
v2 → v3
```

---

## 53. Rollback Testing

Verify:

```text
v3
↓
Deployment failure
↓
Rollback
↓
v2 works
```

---

## 54. Configuration Testing

Test:

- Environment variables
- Missing variables
- Invalid configuration
- Production configuration
- Development configuration
- Feature flags

---

# Business Testing

## 55. Acceptance Testing

Verify the software meets business requirements.

Example:

```text
Given:
User has Pro subscription

When:
User opens dashboard

Then:
Pro features are available
```

---

## 56. User Acceptance Testing (UAT)

Actual users/stakeholders test the application before release.

---

## 57. Business Logic Testing

Test rules such as:

- Pricing
- Discounts
- Taxes
- Permissions
- Subscription limits
- Quotas
- Credits
- Billing periods

---

# Human Testing

## 58. Exploratory Testing

Humans intentionally try unusual behavior.

Example:

```text
Open checkout in two tabs
↓
Change account email
↓
Apply coupon
↓
Disconnect Wi-Fi
↓
Click Pay twice
↓
Reconnect
↓
Reload
```

This can discover bugs automated tests never anticipated.

---

## 59. Usability Testing

Observe real users using the product.

Detect:

- Confusing interfaces
- Unexpected workflows
- Misleading buttons
- Difficult navigation
- User errors

---

# Production Testing & Monitoring

## 60. Error Monitoring

Track:

- Exceptions
- Crashes
- Failed requests
- Stack traces
- JavaScript errors

---

## 61. Logging

Monitor:

- Application logs
- Authentication logs
- Database logs
- Worker logs
- Infrastructure logs

---

## 62. Metrics Monitoring

Monitor:

- Request count
- Error rate
- Latency
- CPU
- RAM
- Disk
- Database connections
- Queue size

---

## 63. Distributed Tracing

Trace requests across systems.

```text
Browser
↓
API
↓
Auth Service
↓
Database
↓
Payment Service
```

Useful for finding where failures or latency originate.

---

## 64. Real User Monitoring (RUM)

Measure actual user experience.

Monitor:

- Page load
- Core Web Vitals
- API latency
- JavaScript errors
- Device/browser issues

---

## 65. Synthetic Monitoring

Automated bots continuously test the production application.

Example:

```text
Every 5 minutes:

Open application
↓
Login
↓
Perform critical action
↓
Verify result
```

---

## 66. Uptime Monitoring

Continuously verify:

- Website availability
- API availability
- DNS
- SSL certificates
- Critical services

---

## 67. Business KPI Monitoring

Technical monitoring isn't enough.

Monitor unexpected changes in:

```text
Signups
Payments
Conversions
Bookings
Orders
Emails sent
Subscriptions
Cancellations
```

Example:

```text
Payments normally:
100/hour

Suddenly:
2/hour

No server errors.

→ There may still be a serious bug.
```

---

# Release Safety

## 68. Feature Flags

Deploy code without immediately enabling it for everyone.

---

## 69. Canary Deployment

Release to a small percentage of users first.

```text
1%
↓
5%
↓
20%
↓
50%
↓
100%
```

Monitor errors between each stage.

---

## 70. Blue/Green Deployment

Maintain:

```text
BLUE
Current production

GREEN
New version
```

Switch traffic only after GREEN passes tests.

---

## 71. Shadow Traffic

Send copies of real production requests to the new system without affecting users.

```text
Production request
       │
       ├── Current API → User
       │
       └── New API → Ignore response
```

Compare results.

---

## 72. Automated Rollback

Automatically rollback deployment when:

- Error rate increases
- Latency increases
- Health checks fail
- Critical tests fail
- Business metrics collapse

---

# Recommended Testing Architecture

```text
SOURCE CODE
│
├── Compiler
├── Type checking
├── Linting
├── Formatting
├── Static analysis
├── Secret scanning
├── Dependency scanning
└── SAST
│
▼
UNIT TESTS
│
├── Unit tests
├── Edge cases
├── Property-based tests
└── Mutation testing
│
▼
COMPONENT TESTS
│
▼
INTEGRATION TESTS
│
├── Database
├── APIs
├── Cache
├── Queues
├── Contracts
└── Third-party services
│
▼
E2E TESTS
│
├── Critical user journeys
├── UI
├── Accessibility
└── Visual regression
│
▼
SYSTEM TESTS
│
├── Performance
├── Security
├── Fuzzing
├── Concurrency
├── Failure injection
└── Chaos testing
│
▼
DEPLOYMENT
│
├── Smoke tests
├── Health checks
├── Canary release
└── Automated rollback
│
▼
PRODUCTION
│
├── Error monitoring
├── Logs
├── Metrics
├── Tracing
├── RUM
├── Synthetic monitoring
├── Uptime monitoring
└── Business KPI monitoring
```

---

# Recommended Baseline for a Modern SaaS / Web Application

At minimum:

### Every Commit

- [ ] Type checking
- [ ] Linting
- [ ] Formatting
- [ ] Unit tests
- [ ] Secret scanning
- [ ] Dependency scanning

### Every Pull Request

- [ ] Everything from commits
- [ ] Integration tests
- [ ] API tests
- [ ] Contract tests
- [ ] Database tests
- [ ] Migration tests
- [ ] E2E critical paths
- [ ] Accessibility tests
- [ ] Visual regression tests

### Before Production

- [ ] Full E2E suite
- [ ] Smoke tests
- [ ] Security tests
- [ ] Performance tests
- [ ] Migration tests
- [ ] Backup/restore verification
- [ ] Critical business-flow tests

### During Deployment

- [ ] Health checks
- [ ] Smoke tests
- [ ] Canary deployment
- [ ] Error-rate monitoring
- [ ] Latency monitoring
- [ ] Automated rollback

### Production 24/7

- [ ] Error monitoring
- [ ] Uptime monitoring
- [ ] Logs
- [ ] Metrics
- [ ] Distributed tracing
- [ ] RUM
- [ ] Synthetic E2E tests
- [ ] Security monitoring
- [ ] Business KPI monitoring

---

# Core Principle

No single type of testing catches every bug.

A strong software quality system combines:

```text
PREVENT BUGS
    ↓
Static Analysis + Type Safety

DETECT LOGIC BUGS
    ↓
Unit + Property Tests

DETECT INTERACTION BUGS
    ↓
Integration + Contract Tests

DETECT USER-FLOW BUGS
    ↓
E2E + UI Tests

DETECT UNKNOWN BUGS
    ↓
Fuzzing + Exploratory Testing

DETECT SCALE BUGS
    ↓
Load + Stress + Concurrency Testing

DETECT SECURITY BUGS
    ↓
SAST + DAST + Pentesting

DETECT INFRASTRUCTURE BUGS
    ↓
Failure Injection + Chaos Testing

LIMIT RELEASE DAMAGE
    ↓
Canary + Feature Flags + Rollbacks

DETECT PRODUCTION BUGS
    ↓
Monitoring + Tracing + Synthetic Tests
```

The objective is not to have the largest possible number of tests.

The objective is to build multiple layers of defense so that a bug missed by one layer is likely to be detected by another.