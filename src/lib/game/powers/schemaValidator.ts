import Ajv from "ajv";
import schema from "../../../../docs/power-dsl.schema.json";

const ajv = new Ajv({ allErrors: true });
const runtimeSchema = { ...schema } as Record<string, unknown>;
delete runtimeSchema.$schema;
const validate = ajv.compile(runtimeSchema);

function formatError(error: { instancePath?: string; message?: string; keyword?: string; params?: { missingProperty?: string } }): string {
  const path = error.instancePath || "/";
  const missing = error.keyword === "required" ? ` Missing property: ${error.params?.missingProperty ?? "unknown"}.` : "";
  return `${path}: ${error.message ?? "Validation failed."}${missing}`;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePowerSchema(input: unknown): ValidationResult {
  const valid = validate(input);
  const errors = Array.isArray(validate.errors)
    ? validate.errors.map((error) => formatError(error as { instancePath?: string; message?: string; keyword?: string; params?: { missingProperty?: string } }))
    : [];

  return {
    valid: Boolean(valid),
    errors: valid ? [] : errors
  };
}
