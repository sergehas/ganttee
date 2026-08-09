import * as path from "path";

// __dirname is out/test/ when compiled; source fixtures live two levels up from there.
export const FIXTURES_DIR = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "test",
  "fixtures",
);
