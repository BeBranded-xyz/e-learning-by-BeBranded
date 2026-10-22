---
description: PHP rules — PHP 8.x, strict_types, PSR-12 via php-cs-fixer, PHPStan max, composer lockfile, readonly/enums, exception hierarchy, PHPUnit/Pest, Infection, plus WordPress specifics. Apply to every PHP file and composer.json.
paths:
  - "**/*.php"
  - "composer.json"
---

# PHP

## When this applies

Apply to every file matching the globs. The PHP version, framework (Laravel,
Symfony, WordPress, none), and hosting constraints live in `PROJECT.md`. The
"WordPress specifics" section applies only when `PROJECT.md` declares WordPress.
Core size limits, dead-code, error, and observability rules apply unless
overridden below.

## Toolchain

| Role | Tool | Notes |
|---|---|---|
| Version manager | `php` pinned via `composer.json` `"php": "^8.x"` + `.php-version` / container | Never rely on the system PHP |
| Package manager | `composer` | `composer.lock` committed; `composer install` in CI |
| Formatter | `php-cs-fixer` (`@PSR12` + `@PHP8xMigration` rulesets) | Config in `.php-cs-fixer.dist.php` |
| Linter | `php -l` + `phpcs` (PSR-12; WordPress standard when relevant) | `phpcs.xml.dist` at root |
| Type checker | `phpstan` level `max` (or `psalm` level 1) | Config in `phpstan.neon.dist`; baseline only for legacy, shrinking |
| Test runner | `phpunit` or `pest` | Pick one in `PROJECT.md` |
| Check command | `composer check` | Runs cs-fixer dry-run + phpcs + phpstan + tests + audit |

- **`declare(strict_types=1);` is the first statement of every PHP file.**
  Enforced by php-cs-fixer and phpcs.
- **PHPStan extensions** for the framework in use (`phpstan-strict-rules`,
  `phpstan-deprecation-rules`, plus the framework extension).
- **No `@phpstan-ignore` without a reason and an issue link**; baselines are
  reviewed monthly and must only shrink.

## Project layout

```
composer.json / composer.lock
src/<Namespace>/           (PSR-4 autoload, one class per file)
  Domain/                  (entities, value objects, enums, domain exceptions)
  Application/             (use cases / services)
  Infrastructure/          (DB, HTTP clients, framework glue)
  Http/                    (controllers, requests, responses)
tests/
  Unit/  Integration/  Feature/
public/index.php           (single entry; no logic)
config/
bin/                       (CLI entry points)
phpstan.neon.dist  phpcs.xml.dist  .php-cs-fixer.dist.php  phpunit.xml.dist
```

- **PSR-4 only**; no manual `require`. Namespace mirrors the directory.
- **One declaration (class, interface, enum, trait) per file**, file named
  exactly as the declaration.

## Naming conventions

| Item | Convention | Example |
|---|---|---|
| Namespaces / classes / enums / interfaces | `PascalCase` | `OrderService`, `OrderStatus` |
| Interfaces | noun or adjective, no `I` prefix | `Repository`, `Clock` |
| Abstract classes | `Abstract` prefix | `AbstractHandler` |
| Traits | `-able` or `-Trait` suffix | `Loggable`, `HasTimestamps` |
| Methods / variables / properties | `camelCase` | `lockProduct`, `$cartCount` |
| Constants / enum cases | `UPPER_SNAKE_CASE` / `PascalCase` cases | `MAX_RETRIES`, `Status::Shipped` |
| Exceptions | `<Reason>Exception` | `OrderNotFoundException` |
| Test classes / methods | `<Class>Test` / `test_it_<behaviour>` or `it('...')` | `OrderServiceTest` |
| Files | match the declaration | `OrderService.php` |
| DB tables / columns | `snake_case` | `cart_locks` |

## Language idioms and rules

### Types
- **Every parameter, return, and property is typed.** No `mixed` outside a
  documented third-party boundary; use a union or a value object instead.
- **Never `array` as a public type when the shape is known**: use a DTO
  (`final readonly class`) or `list<T>`/`array<string, T>` PHPDoc for PHPStan.
- **`final` by default** on classes; open a class only with a documented
  extension point.
- **`readonly` properties and `final readonly class` for value objects**;
  mutate by returning a new instance (`with*` methods).
- **Backed enums for closed sets** with a `label()` method; never string
  constants for status values.
- **No `null` returns for "not found"** in domain code; throw or return a
  dedicated result object. Nullable types are explicit (`?Foo`), never implied.

### Errors
- **One exception hierarchy per package** rooted in a marker interface
  (`AppException`) with a `code(): string` machine-readable reason.
- **Never an empty `catch`; never `catch (\Throwable)` that swallows**; catch
  the narrowest type and rethrow with `previous`.

```php
final class OrderNotFoundException extends \RuntimeException implements AppException
{
    public static function withId(OrderId $id): self
    {
        return new self(sprintf('Order %s not found', $id->toString()));
    }

    public function code(): string
    {
        return 'order_not_found';
    }
}
```

### Immutability, resources, misc
- **Constructor injection only**; no service locators, no `static` state,
  no `global`.
- **`===` always**; never loose comparison. `in_array(..., strict: true)`.
- **Resources closed in `finally`** (streams, curl handles, DB transactions).
- **Logging via PSR-3** with structured context arrays; no `var_dump`,
  `print_r`, `error_log` in committed code; no PII in context.

### Forbidden
- `extract`, `compact` for data flow, `eval`, `create_function`, `goto`,
  `@` suppression, `$$variable`, `global`, `mixed` without justification,
  `__get/__set` magic in domain code, `exit`/`die` outside CLI entry points.

### WordPress specifics

Apply only when `PROJECT.md` declares WordPress. WordPress code still uses
`strict_types`, typed signatures, and the PSR-4 `src/` layout inside the
plugin or theme; procedural glue is limited to the entry file.

- **Never edit core, third-party plugins, or a parent theme.** Extend through
  hooks, a child theme, or a must-use plugin.
- **Hooks are the extension mechanism**: register in a dedicated
  `Hooks`/`ServiceProvider` class; prefix every hook, option, transient, and
  function with the project prefix from `PROJECT.md`.
- **Sanitise on input, escape on output, every time**: `sanitize_text_field`,
  `sanitize_email`, `absint`, `wp_kses_post` when reading; `esc_html`,
  `esc_attr`, `esc_url`, `wp_kses` when printing. Never `echo $var` raw.
- **Nonces on every state-changing request**: `wp_nonce_field` /
  `wp_create_nonce` paired with `check_admin_referer` / `wp_verify_nonce`,
  plus a capability check (`current_user_can`).
- **Database only through `$wpdb->prepare()`** with placeholders or the WP
  APIs (`WP_Query`, `get_posts`, options, meta). Never interpolate into SQL.
- **No queries in templates**: templates receive data from a controller or
  view-model class; `template_part` files only echo escaped values.
- **Plugin structure**: `plugin.php` (header + bootstrap only), `src/`,
  `assets/`, `languages/`, `uninstall.php`; activation/deactivation hooks are
  idempotent.
- **WP-CLI** for operational tasks (`wp <prefix> <command>`) instead of admin
  page buttons; commands are classes under `src/Cli/`.
- **PHPCS with `WordPress` + `WordPress-Extra` standards** in `phpcs.xml.dist`
  alongside PHPStan with the WordPress extension.

## Size limit overrides for PHP

| Scope | Limit | Reason |
|---|---|---|
| Framework migration / seeder file | 200 lines | Declarative, one concern each |
| Generated (proxies, cached config) | exempt | Never hand-edited |

All other core limits (300/50/3/4/10) apply unchanged.

## Dependencies

- **Add with `composer require <pkg>`** (`--dev` for tooling); commit
  `composer.lock` in the same change. Never edit `composer.lock` by hand.
- **Caret constraints** (`^2.1`); never `dev-master`/`*`.
- **`composer audit`** in `composer check` and CI; fail on any advisory
  without a documented exception.

## Testing

Tests live in `tests/`, mirror `src/`, run with `composer test`
(`phpunit --testdox` or `pest --parallel`).

| Category | Tool | Rule |
|---|---|---|
| Unit | PHPUnit / Pest | Every public method; data providers for cases |
| Property-based | `eris` or Pest `->with()` generators | Value objects, parsers, money/date math |
| Integration | PHPUnit + `testcontainers` or DB in Docker | Real DB; never mock the query layer |
| Feature / HTTP | framework test client (Laravel, Symfony `WebTestCase`) | Every endpoint: auth, validation, happy path |
| WordPress | `wp-phpunit` + `brain/monkey` for hooks | Every hook callback and shortcode |
| Contract | `php-vcr` / mocked HTTP client with recorded fixtures | Every external API wrapper |
| Mutation | `infection` | Domain packages; MSI threshold in `PROJECT.md` |
| Static | `phpstan` max, `psalm` taint analysis | In `composer check` |
| Security | `composer audit` | In `composer check` |

- **Mock only at boundaries** (interfaces injected in constructors); never
  mock final classes or the class under test.
- **Inject `Clock` and randomness**; freeze in tests.

## Security specifics

- **Validate every request** with a schema/validator class at the edge;
  never read `$_GET`, `$_POST`, `$_REQUEST` outside the request adapter.
- **Escape output per context** (HTML, attribute, URL, JS); templating engines
  with auto-escaping on.
- **Prepared statements only** (PDO with `ATTR_EMULATE_PREPARES = false`,
  ORM, or `$wpdb->prepare`).
- **Passwords via `password_hash`/`password_verify`**; tokens via
  `random_bytes`; comparisons via `hash_equals`.
- **Secrets from env** (`$_ENV` through a config object), never in code or
  committed `.env`; `.env.example` committed.
- **No file includes from user input**; uploads validated by MIME sniffing
  and stored outside the web root.

## Checklist when touching PHP code

- [ ] `declare(strict_types=1)` first line; every signature typed; no `mixed`
- [ ] `php-cs-fixer` and `phpcs` clean; `phpstan` max passes without new ignores
- [ ] Classes `final`; value objects `readonly`; enums for closed sets
- [ ] Exceptions typed with a reason code; no empty catch, no `@`
- [ ] Constructor injection; no globals, statics, or service locators
- [ ] File under 300 lines, methods under 50, nesting under 3
- [ ] Unit + integration tests added; Infection score maintained
- [ ] `composer.lock` updated; `composer audit` clean
- [ ] Input validated at the edge; output escaped per context; prepared statements
- [ ] WordPress: hooks prefixed, nonces + capability checks, `$wpdb->prepare`, no core edits
- [ ] PSR-3 structured logs, no PII, no `var_dump`/`print_r`
