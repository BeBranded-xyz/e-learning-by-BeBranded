# Security policy

## Reporting a vulnerability

**Please do not open a public issue, discussion or pull request for a security vulnerability.**

Report it privately through GitHub: go to the **Security** tab of this repository and click **Report a vulnerability**. This opens a private advisory that only the maintainers can see.

Please include:

- the affected package and version (or commit);
- a description of the issue and its impact;
- steps to reproduce, or a proof of concept;
- any suggested fix, if you have one.

We aim to acknowledge reports within **3 business days** and to share a remediation plan within **10 business days**. We will credit you in the advisory unless you prefer to stay anonymous.

## Scope

In scope: every package published from this repository (`@bebranded/elearning-*`) and the code in this repository.

Out of scope: vulnerabilities in host products that embed the module, unless they are caused by the module itself; vulnerabilities in third-party services (video providers, databases) that are not caused by how the module uses them.

## Supported versions

Until `1.0.0`, only the latest release receives security fixes. After `1.0.0`, the latest minor version of each supported major version receives security fixes.

## Leaked secrets

If you find a credential, token or key in this repository or its history, report it privately as described above. We will revoke and rotate it first, then clean the history if needed.
