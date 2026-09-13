# Graphology as the Dependency Graph Substrate

Ganttee uses Graphology behind the project-facing `DependencyGraph` abstraction because it provides
the required browser-safe traversal, cycle detection, and connected-component operations without
duplicating graph algorithms. The scheduling graph contains tasks and milestones; groups are handled
separately through post-order hierarchy rollup. Keeping Graphology behind `DependencyGraph`
preserves a stable caller-facing API if the implementation changes later.
