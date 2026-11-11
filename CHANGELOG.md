# Change Log

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](http://semver.org/).

## [2.0.6] - Unreleased

### Fixed
- OIDC sign-in keeps a query already present in the provider's `authorization_endpoint` (for example Casdoor's `?organization=`) and appends its own parameters with `&`.
- Clicking or hovering a list row in Safari now targets that row instead of the last row of the table.

## [2.0.5] - 2026-11-05

### Added
- Passkey registration under Account > Credentials.

### Changed

### Fixed
- Dates and numbers are formatted with the account locale, or the browser's preferred language when the account uses the default, instead of always en-US.
- The last setup screen no longer tells users to sign in with credentials that were never created when an external directory is used.

## [2.0.4] - 2026-11-02

### Added
- New WebUI design with more pizzazz:
    - Cleaner generated forms: two-column fields that stack on mobile, simpler nested objects, collapsible list items, segmented variant pickers, a section index on wide screens and a floating save bar.
    - Dashboards support a layout with stat, chart, headline and ranking tiles, plus column and row spans, tones and delta polarity, all defined in the schema.
- Custom OAuth scopes can be requested through the `oauth-scopes` meta tag; they are added to the scopes required by the server.

### Changed

### Fixed

## [2.0.3] - 2026-10-29

### Added

### Changed
- Logging out no longer revokes the OAuth tokens.

### Fixed
- OAuth sign-in sends the RFC 8707 `resource` parameter in the authorization request, the code exchange and token refreshes, so external identity providers that require an audience or scopes issue tokens the server accepts.

## [2.0.2] - 2026-10-28

### Added

### Changed
- Object pickers in forms are now scoped to the tenant of the record being edited: for objects that belong to a tenant (`memberTenantId`), only options from the same tenant are offered.

### Fixed

## [2.0.1] - 2026-10-27

### Added

### Changed

### Fixed
- Actions page hidden on Stalwart 1.0: create-only objects such as `x:Action` are now shown to accounts holding their Create permission (#27).

## [2.0.0] - 2026-10-26

### Added
- CIMD support.

### Changed

### Fixed

## [1.0.11] - 2026-09-15

### Added
- Sievepad integration.

### Changed

### Fixed

## [1.0.10] - 2026-09-04

### Added

### Changed

### Fixed
- Re-added map entries and object list items are seeded with their schema defaults, including a value for every non-nullable boolean.

## [1.0.9] - 2026-08-24

### Added
- Server configurable OAuth client ID.

### Changed

### Fixed

## [1.0.8] - 2026-07-31

### Added
- Remember the last visited page when switching sections (credits @LinkPhoenix).

### Changed
- Enum list filters with many options render as a searchable combobox (credits @LinkPhoenix).
- Object cells display the variant label as a badge instead of the raw type name (credits @LinkPhoenix).
- Empty date pickers open on the current date and time (credits @LinkPhoenix).

### Fixed
- Custom logos no longer flash when navigating between pages.
- Landing no longer flashes "Select a view" before redirecting to the default page.

## [1.0.7] - 2026-07-30

### Added
- `Ctrl+K` / `Cmd+K` command palette for global search (credits @LinkPhoenix).
- Calendar date picker for date and time fields (credits @LinkPhoenix).
- Dynamic document titles per page (credits @LinkPhoenix).

### Changed
- Code-split the admin shell and heavy feature pages to speed up the initial load (credits @LinkPhoenix).
- Center forms horizontally on wide screens (credits @LinkPhoenix).

### Fixed
- Redirect URLs without a view to the first accessible page of their section (credits @LinkPhoenix).
- Sidebar groups auto-open and scroll the active item into view after navigation (credits @LinkPhoenix).
- Keep the sidebar section synced with the URL on full page loads (credits @LinkPhoenix).
- Date and time fields no longer shift values by the UTC offset when editing (credits @LinkPhoenix).
- Clip the table header background inside the rounded card border (credits @LinkPhoenix).
- Keep the selected account across page reloads (#17).
- Refresh open views when switching accounts (#17).
- Custom logos no longer flash the default logo while loading.

## [1.0.6] - 2026-07-28

### Added
- WebUI version is now displayed when hovering over the logo.

### Changed

### Fixed
- Properly serialize `date` filters when applying them to the list filter.

## [1.0.5] - 2026-06-21

### Added

### Changed

### Fixed
- Redirect to `/login` when there is no refresh token.
- Include required JMAP capabilities in `using`.
- Default scopes omit `offline_access`.

## [1.0.4] - 2026-05-11

### Added

### Changed

### Fixed
- Align `base32` alphabet with the server.

## [1.0.3] - 2026-05-05

### Added

### Changed

### Fixed
- Broken "Delivery History" link on OSS/Community editions.
- Resolve object ids in map keys.

## [1.0.2] - 2026-04-30

### Added
- OIDC:
    - Include `email` and `profile` scopes in OIDC authentication requests.
- TOTP:
    - Add "Copy Secret" button to TOTP setup flow.

### Changed

### Fixed
- Display validation errors returned by the server.

## [1.0.1] - 2026-04-25

### Added
- OIDC:
    - Logout users from IdP when logging out of the app.
    - Include `openid` scope in OIDC authentication requests.

### Changed

### Fixed
- Mobile display issues.
- Editing a secret clears its masked value.
- Array label properties crashes app.

## [1.0.0] - 2026-04-20

### Added
- Initial release.

### Changed

### Fixed

