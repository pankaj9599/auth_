import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

/* =========================
   HEALTH / STARTUP PROBES
========================= */

app.get("/", (req, res) => {
  res.status(200).send("authrepo up");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* =========================
   CLOUDFARE ACTION
========================= */

async function blockUserIP(ip) {
  const zone = process.env.CF_ZONE_ID;
  const token = process.env.CF_API_TOKEN;

  if (!zone || !token) {
    throw new Error("Cloudflare env vars missing");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "block",
        configuration: { target: "ip", value: ip },
        notes: "Auth abuse – ThreatPilot"
      })
    }
  );

  const data = await res.json();
  if (!data.success) throw new Error("Cloudflare block failed");
  return data.result.id;
}

/* =========================
   JIRA ACTION
========================= */

async function createJiraRevokeTicket({ user, token }) {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const baseUrl = process.env.JIRA_BASE_URL;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!email || !apiToken || !baseUrl || !projectKey) {
    throw new Error("Jira env vars missing");
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");

  const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: `[Auth] Revoke Token for ${user}`,
        description: `Token suspected of misuse:\n${token}`,
        issuetype: { name: "Task" },
        labels: ["auth", "token", "security"]
      }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Jira ticket failed");
  return data.key;
}

/* =========================
   SLACK ACTION
========================= */

async function alertSlack(message) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) throw new Error("Slack webhook missing");

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message })
  });
}

/* =========================
   MAIN EXECUTOR ENDPOINT
========================= */

app.post("/execute", async (req, res) => {
  try {
    const { action, user, ip, token } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    // if (action === "block_user") {
    //   const ruleId = await blockUserIP(ip);
    //   return res.json({
    //     status: "success",
    //     action,
    //     cloudflare_rule_id: ruleId
    //   });
    // }

     
    if (action === "block_user") {
      await alertSlack(
        `🔐 block ${ip}\nUser: ${user}\nReason: suspicious behavior`
      );
      return res.json({ status: "success", action });
    }

    // if (action === "revoke_token") {
    //   const jira = await createJiraRevokeTicket({ user, token });
    //   return res.json({
    //     status: "pending_approval",
    //     action,
    //     jira_ticket: jira
    //   });
    // }
         if (action === "revoke_token") {
await alertSlack(
        `🔐 revoke token\nUser: ${user}\nReason: suspicious behavior`
      );
      return res.json({ status: "success", action });
    }

    if (action === "temporary_account_lock") {
      await alertSlack(
        `🔐 TEMP ACCOUNT LOCK\nUser: ${user}\nReason: suspicious behavior`
      );
      return res.json({ status: "success", action });
    }

    if (action === "trigger_alert") {
      await alertSlack(`🚨 AUTH ALERT for user ${user}`);
      return res.json({ status: "success", action });
    }

    return res.status(400).json({
      status: "ignored",
      message: "Unsupported action"
    });

  } catch (e) {
    console.error("❌ Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 authrepo running on port ${PORT}`);
});
