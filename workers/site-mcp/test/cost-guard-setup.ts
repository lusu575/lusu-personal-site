import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { seedCostGuardTestBudget } from "../../../tests/helpers/cost-guard-fixture.mjs";

beforeEach(async () => seedCostGuardTestBudget((env as unknown as { DB: D1Database }).DB));
