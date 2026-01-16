import express from "express";
import { alertSlack } from "./slack.js";
import { blockUserIP } from "./cloudflare.js";
import { createJiraRevokeTicket } from "./jira.js";

const app = express();
app.use(express.json());

/* =========================
   STARTUP / HEALTH PROBES
========================= */

app.get("/", (req, res) => {
  res.status(200).send("authrepo up");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* =========================
   MAIN ENDPOINT
========================= */

app.post("/execute", async (req, res) => {
  try {
    const { action, user, ip, token } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    // 🔒 BLOCK USER (Cloudflare via IP)
    if (action === "block_user") {
      const ruleId = await blockUserIP(ip);
      return res.json({
        status: "success",
        action,
        cloudflare_rule_id: ruleId
      });
    }

    // 🎫 REVOKE TOKEN → JIRA
    if (action === "revoke_token") {
      const jira = await createJiraRevokeTicket({ user, token });
      return res.json({
        status: "pending_approval",
        action,
        jira_ticket: jira
      });
    }

    // 🔔 TEMP ACCOUNT LOCK → SLACK
    if (action === "temporary_account_lock") {
      await alertSlack(
        `🔐 TEMP ACCOUNT LOCK\nUser: ${user}\nReason: suspicious behavior`
      );
      return res.json({ status: "success", action });
    }

    // 🚨 ALERT ONLY
    if (action === "trigger_alert") {
      await alertSlack(`🚨 AUTH ALERT for user ${user}`);
      return res.json({ status: "success", action });
    }

    return res.status(400).json({ status: "ignored", message: "Unsupported action" });

  } catch (e) {
    console.error("❌ Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 authrepo running on port ${PORT}`);
});
