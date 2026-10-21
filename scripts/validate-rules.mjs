// Validate rules/<kind>/**/*.json against rules/schema/<kind>.schema.json (Ajv).
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
  for (const name of readdirSync(rulesDir)) {
    const dir = join(rulesDir, name);
    if (name === "schema" || !statSync(dir).isDirectory()) continue;
    const files = jsonFiles(dir);
    if (files.length === 0) continue;
    const schemaPath = join(schemaDir, `${name}.schema.json`);
    if (!existsSync(schemaPath)) {
      errors.push(`rules/${name}: no schema at rules/schema/${name}.schema.json`);
      continue;
    }
    const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
    for (const f of files) {
      if (!validate(JSON.parse(readFileSync(f, "utf8")))) {
        errors.push(`${relative(rulesDir, f)}: ${ajv.errorsText(validate.errors)}`);
      }
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
