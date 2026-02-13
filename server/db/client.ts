import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT || "http://localhost:8000";

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  ...(endpoint ? { endpoint } : {}),
  ...(endpoint
    ? {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
        },
      }
    : {}),
});

export const ddb = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_AUDITS = "weaudit-audits";
export const TABLE_STATEMENTS = "weaudit-statements";
export const TABLE_FINDINGS = "weaudit-findings";
export const TABLE_DOWNGRADE_RULES = "weaudit-downgrade-rules";
export const TABLE_PROCESSOR_ISOS = "weaudit-processor-isos";
export const TABLE_UNKNOWN_FEES = "weaudit-unknown-fees";
export const TABLE_NOTICES = "weaudit-notices";
export const TABLE_COMPANIES = "weaudit-companies";
