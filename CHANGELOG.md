# Changelog

## [0.1.2] - 2026-07-11

### Changed
- Internal code style improvements, no functional changes.

## [0.1.1] - 2026-07-11

### Fixed
- Fixed critical testing incompatibility where MSW (Mock Service Worker) failed to intercept `fetch` requests in the Bun runtime, causing tests to inadvertently hit the live network and fail with `401 Unauthorized`.
- Refactored `FetchClient` and `SumoPodClient` to support manual Dependency Injection (DI) of a `fetchImpl` function, allowing tests to run entirely offline across all runtimes.
- Replaced MSW with a lightweight, runtime-agnostic manual fetch mocker (`test/__mocks__/fetch-mock.ts`).

## [0.1.0] - 2026-07-11

### Added
- Initial release of `sumopod-pay` SDK.
- Core HTTP client with exponential backoff and rate limiting.
- SSRF prevention and timing attack protections.
- Express middleware and NestJS dynamic module for webhook verification.
