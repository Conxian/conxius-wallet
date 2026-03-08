# Documentation Alignment Spec

## ADDED Requirements

### Requirement: REQ-DOC-001 - Unified Versioning
The system MUST ensure all PRDs and Roadmap files target version v1.6.0.

#### Scenario: Verify PRD Version
- Given the Business PRD file exists
- When I read the title
- Then it should contain "v1.6.0"

### Requirement: REQ-DOC-002 - Native Stack Mapping
The system MUST explicitly map the Kotlin native modules in the Module Spec.

#### Scenario: Verify Native Modules
- Given the Module Spec exists
- When I check the Android Native Modules section
- Then I should see ":core-crypto", ":core-bitcoin", ":core-database", and ":app"
