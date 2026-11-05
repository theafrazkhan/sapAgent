# Contribution and release workflow

Use focused Conventional Commits (`docs:`, `feat:`, `fix:`, `test:`, `chore:`). Start changes on short-lived branches and use reviewed pull requests once GitHub is connected. Keep main runnable. Do not rewrite shared history.

Version application with SemVer. Until MVP integration is complete use `0.1.0-alpha.N`. Update CHANGELOG for behavior/schema/tool-contract changes. Tag releases with annotated `vX.Y.Z` tags. Migration versions are monotonic and independent of application semver.

Before commit: typecheck, meaningful tests, production build, inspect git diff and ensure secrets/customer data are ignored. Commit lockfile. Never edit a migration already applied. Add a new migration, update database docs and test upgrading from the prior version.

Tests prioritize boundaries: tenant isolation, snapshot consistency, spreadsheet validation, duplicate imports, units and missing-field semantics, tool authorization and model budgets. Synthetic fixtures only in Git.
