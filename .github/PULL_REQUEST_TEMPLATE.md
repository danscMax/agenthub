<!-- Thanks for contributing! Keep the PR focused on one topic. -->

## What & why

<!-- What does this change and what problem does it solve? -->

## Checklist

- [ ] `npm run check` is 0/0
- [ ] `npm run check:i18n` passes (ru/en/zh in parity)
- [ ] `npm test` passes
- [ ] `cargo clippy ... -D warnings` and `cargo test` pass (built `build/` first)
- [ ] New user-facing strings go through `t('ns.key')` in all three locales
- [ ] No new streaming path / duplicated helper (reused `spawn_streamed` / existing components)
