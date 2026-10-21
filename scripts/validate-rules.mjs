// Validate rules/<kind>/**/*.json and rules/<kind>.json against rules/schema/<kind>.schema.json (Ajv).
// Passes when rules/ is empty. Returns a list of error strings.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

function jsonFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return name.endsWith(".json") ? [p] : [];
  });
}

export function validateRules(rulesDir) {
  const errors = [];
  if (!existsSync(rulesDir)) return errors;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const schemaDir = join(rulesDir, "schema");
  const check = (name, files) => {
    const schemaPath = join(schemaDir, `${name}.schema.json`);
    if (!existsSync(schemaPath)) {
      errors.push(`rules/${name}: no schema at rules/schema/${name}.schema.json`);
      return;
    }
    const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
    for (const f of files) {
      if (!validate(JSON.parse(readFileSync(f, "utf8")))) {
        errors.push(`${relative(rulesDir, f)}: ${ajv.errorsText(validate.errors)}`);
      }
    }
  };
  for (const name of readdirSync(rulesDir)) {
    const p = join(rulesDir, name);
    if (name === "schema") continue;
    if (statSync(p).isDirectory()) {
      const files = jsonFiles(p);
      if (files.length > 0) check(name, files);
    } else if (name.endsWith(".json")) {
      check(name.slice(0, -".json".length), [p]);
    }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateRules(fileURLToPath(new URL("../rules", import.meta.url)));
  for (const e of errors) console.error(e);
  console.log(errors.length ? `validate:rules failed (${errors.length})` : "validate:rules ok");
  process.exit(errors.length ? 1 : 0);
}
