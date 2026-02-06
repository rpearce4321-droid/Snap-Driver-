# Fixes Log

## Seeker Login Flicker (Profile loads, blank page fights, eventually resolves)
- **Status:** Unresolved (as of 2026-02-06)
- **Symptoms:** Seeker login shows blank/“no profile” state fighting with real profile; eventually settles after ~1 minute.
- **Notes:** Retainer login does not exhibit the issue. Occurs during initial login; refresh sometimes resolves.
- **Impact:** Blocks normal use; causes flashing and confusion.
- **Next step:** Diagnose why seeker list is overwritten during server sync (local -> server pull race) and prevent UI from rendering the empty state while session profile is resolving.
