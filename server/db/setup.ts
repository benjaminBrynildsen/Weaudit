import {
  CreateTableCommand,
  DescribeTableCommand,
  type CreateTableCommandInput,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

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

const tables: CreateTableCommandInput[] = [
  {
    TableName: "weaudit-audits",
    KeySchema: [{ AttributeName: "auditId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "auditId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-statements",
    KeySchema: [{ AttributeName: "statementId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "statementId", AttributeType: "S" },
      { AttributeName: "auditId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "auditId-index",
        KeySchema: [{ AttributeName: "auditId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-findings",
    KeySchema: [{ AttributeName: "findingId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "findingId", AttributeType: "S" },
      { AttributeName: "auditId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "auditId-index",
        KeySchema: [{ AttributeName: "auditId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-downgrade-rules",
    KeySchema: [{ AttributeName: "ruleId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "ruleId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-processor-isos",
    KeySchema: [{ AttributeName: "isoId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "isoId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-unknown-fees",
    KeySchema: [{ AttributeName: "unknownFeeId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "unknownFeeId", AttributeType: "S" },
      { AttributeName: "findingId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "findingId-index",
        KeySchema: [{ AttributeName: "findingId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-notices",
    KeySchema: [{ AttributeName: "noticeId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "noticeId", AttributeType: "S" },
      { AttributeName: "auditId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "auditId-index",
        KeySchema: [{ AttributeName: "auditId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "weaudit-companies",
    KeySchema: [{ AttributeName: "companyId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "companyId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
];

async function tableExists(name: string): Promise<boolean> {
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

export async function setupTables() {
  for (const def of tables) {
    const name = def.TableName!;
    if (await tableExists(name)) {
      console.log(`  Table ${name} already exists — skipping`);
      continue;
    }
    await rawClient.send(new CreateTableCommand(def));
    console.log(`  Created table ${name}`);
  }
}

// Run directly: npx tsx server/db/setup.ts
if (process.argv[1]?.endsWith("setup.ts") || process.argv[1]?.endsWith("setup")) {
  console.log("Setting up DynamoDB tables...");
  setupTables()
    .then(() => console.log("Done."))
    .catch((e) => {
      console.error("Setup failed:", e);
      process.exit(1);
    });
}
