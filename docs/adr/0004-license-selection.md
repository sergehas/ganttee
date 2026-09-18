---
Status: accepted
---

# Select the GNU Affero General Public License

## Context

The project needs an open-source license that permits use in commercial contexts while discouraging
proprietary redistribution and resale without corresponding source-code obligations.

The candidate licenses are MIT, GPL, BSD, and AGPL. The license must also fit the project's goal of
keeping improvements available to the community, including improvements made to software offered
over a network.

## Decision

Use the GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later), for
the project.

AGPL permits commercial use. It requires recipients who distribute modified versions, including
versions offered as a network service, to provide the corresponding source under the same license
terms.

AGPL does not absolutely prohibit resale. Open-source licenses generally permit commercial
distribution, including selling copies or services. This decision therefore treats "preventing
resale" as preventing proprietary resale without the required source-code and license obligations.
An absolute prohibition on resale would require terms that are not compatible with an open-source
license.

## Considered Options

### MIT

Rejected. MIT permits commercial use, modification, and resale with minimal obligations. It does not
require derivative works or hosted modifications to remain available under the same license.

### GPL

Rejected. GPL provides strong copyleft for distributed derivative works and permits commercial use,
but it does not extend the source-availability trigger to users interacting with modified software
over a network.

### BSD

Rejected. BSD permits commercial use and resale with minimal obligations. Like MIT, it does not
preserve source availability for derivative works or network services.

### AGPL

Selected. AGPL combines commercial use with strong copyleft and adds source availability obligations
for modified software delivered over a network.

## Consequences

Positive consequences:

- Commercial users may use and distribute the software under AGPL terms.
- Modifications and network-served versions remain subject to source-code availability obligations.
- The project receives strong protection against proprietary forks being distributed without
  corresponding license and source obligations.

Negative consequences:

- Organizations that cannot comply with AGPL obligations may avoid adoption.
- Contributors and distributors must preserve license notices and provide the required corresponding
  source.
- Commercial resale is not prohibited; it remains allowed when the AGPL terms are followed.
- The project may need contributor and distribution guidance to explain AGPL obligations clearly.

## Revisit Conditions

Revisit this decision if the project needs to prohibit resale absolutely, if a commercial licensing
model is introduced, or if legal review identifies a license compatibility or contributor-rights
concern.
