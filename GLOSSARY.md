# P.R.I.S.M Domain Language

Shared language for the business boundaries and ownership decisions in Prism.

## Cross-domain ownership

**Write domain**:
A cohesive business responsibility that owns its decisions, invariants, and changes to its records.
_Avoid_: Schema, module

**Domain owner**:
The context accountable for applying its rules, even when another context requests a change.
_Avoid_: Caller, table consumer

**Owner capability**:
A request the domain owner validates and applies while keeping its own rules authoritative.
_Avoid_: Direct write, shared service

**External reference**:
An identifier for an object whose decisions belong to another domain; the identifier does not transfer ownership.
_Avoid_: Cross-domain entity

**Current-state reference**:
An external identifier whose target owner must confirm existence, eligibility, and required event scope before a new command commits.
_Avoid_: Foreign key as authorization

**Historical attribution**:
An external identifier retained to explain a completed action; it does not prove current account access, event scope, or target eligibility.
_Avoid_: Live authorization

**Read model**:
A role-scoped view composed from owner-provided information; it does not change the source information.
_Avoid_: Shared write model

**Projection**:
A versioned summary of another domain's state, kept for a defined consumer and subordinate to the owner's current state.
_Avoid_: Second source of truth
