---
name: new-parameter
description: Add a rule parameter to rules/parameters.json, with tests. Use only when the owner has supplied the parameter and its options.
argument-hint: <parameter.id> <short description>
disable-model-invocation: true
---

Add a new rule parameter: $ARGUMENTS

1. Read `docs/RULES.md` (the sections the parameter touches) and `rules/schema/parameters.schema.json`.
2. Add the entry to `rules/parameters.json`. Status must be `proposed`. If the default is not known, set it to `null` and `needsDecision` to `true`. Don't guess defaults or options.
3. List everything the parameter affects in `affects`, including setup constraints.
4. Add tests for the default and for every option, once the engine exists.
5. Validate the registry against the schema and summarize what you added.
