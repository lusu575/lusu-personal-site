import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { seedCostGuardTestBudget } from "../../../tests/helpers/cost-guard-fixture.mjs";

beforeEach(async () => seedCostGuardTestBudget(env.DB));
