# Chart Theme Colors

The `color` array in `media/*-theme.json` is zero-indexed. Ganttee assigns these fixed roles:

| Index | Usage                                                                   |
| ----- | ----------------------------------------------------------------------- |
| `0`   | Group in default style                                                  |
| `1`   | Task in default style                                                   |
| `2`   | Milestone in default style                                              |
| `3`   | Dependencies in default style                                           |
| `4`   | Timeline labels (all color styles)                                      |
| `5`   | Off days (all color styles)                                             |
| `6`   | Holidays (all color styles)                                             |
| `7`   | Critical-path items and dependencies (all color styles)                 |
| `8`+  | colors in colored style, assigned in project order and cycled as needed |

Critical-path color overrides other item colors. Status and inherited group colors take precedence
over the fallbacks.
