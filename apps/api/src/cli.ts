/**
 * Account administration on the server (inside the app container):
 *   node dist/cli.js create-admin <username>
 *   node dist/cli.js create-user <username>
 *   node dist/cli.js reset-password <username>
 *   node dist/cli.js list-users
 * Passwords are asked interactively (hidden), or read from stdin with --password-stdin.
 */
import { passwordRules } from "@fitness/shared";
import { createInterface } from "node:readline";
import { openDatabase } from "./db/client";
import { createUser, findUserByName, listUsers, setDisabled, setPassword, UserError } from "./users";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => { if (!muted) out.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
    muted = true;
  });
}

async function readStdin(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

async function getPassword(): Promise<string> {
  if (process.argv.includes("--password-stdin")) return readStdin();
  if (!process.stdin.isTTY) throw new UserError("No terminal: use --password-stdin, or run with `docker compose exec -it`");
  const first = await askHidden("Password (8+ characters, a number and a special character): ");
  const r = passwordRules(first);
  if (!r.length || !r.number || !r.special) throw new UserError("Password needs 8+ characters, a number and a special character");
  const second = await askHidden("Repeat password: ");
  if (first !== second) throw new UserError("Passwords don't match");
  return first;
}

async function main() {
  const [cmd, username] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const database = await openDatabase({ url: process.env.DATABASE_URL, dataDir: process.env.DATABASE_URL ? undefined : "./.data/pglite" });
  const { db } = database;
  try {
    switch (cmd) {
      case "create-admin":
      case "create-user": {
        if (!username) throw new UserError(`Usage: ${cmd} <username>`);
        const u = await createUser(db, username, await getPassword(), cmd === "create-admin" ? "admin" : "user");
        console.log(`Created ${u.role} "${u.username}".`);
        break;
      }
      case "reset-password": {
        if (!username) throw new UserError("Usage: reset-password <username>");
        const u = await findUserByName(db, username);
        if (!u) throw new UserError(`No user "${username}"`);
        await setPassword(db, u.id, await getPassword());
        console.log(`Password changed for "${u.username}". All their sessions were ended.`);
        break;
      }
      case "enable-user": {
        const u = username ? await findUserByName(db, username) : null;
        if (!u) throw new UserError(`No user "${username ?? ""}"`);
        await setDisabled(db, u.id, false);
        console.log(`Enabled "${u.username}".`);
        break;
      }
      case "list-users": {
        const list = await listUsers(db);
        if (!list.length) console.log("No users yet. Create the admin with: create-admin <username>");
        for (const u of list) {
          console.log(`${u.username.padEnd(24)} ${u.role.padEnd(6)} ${u.disabled ? "disabled" : "active  "} last login: ${u.lastLoginAt ?? "never"}  workouts: ${u.workouts}`);
        }
        break;
      }
      default:
        console.log("Commands: create-admin <username> | create-user <username> | reset-password <username> | enable-user <username> | list-users   [--password-stdin]");
        process.exitCode = cmd ? 1 : 0;
    }
  } catch (e) {
    console.error(e instanceof UserError ? `Error: ${e.message}` : e);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

await main();
