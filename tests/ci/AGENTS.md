# CI contract guidance

Artifact action references must be immutable 40-hex pins. Contract tests should enforce artifact identity, source SHA/run binding, step ordering, missing-file rejection, dependency approval, and retry/recovery confirmation while allowing reviewed pin updates.

Read `../../docs/operations/CAPABILITY_TRUTH.md` before changing support assertions. Registry counts and implemented primitives are separate from live provider evidence and production-qualified operations. Preserve fail-closed value-operation and release gates.
