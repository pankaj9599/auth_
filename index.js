import express from "express";
import { alertSlack } from "./slack.js";
import { blockUserIP } from "./cloudflare.js";
import { createJiraRevokeTicket } from "./jira.js";

const app = express();
app.use(express.json());

app.post("/execute", async (req, res) => {
  try {
    const { action, user, ip, token } = req.body;

    if (action === "block_user") {
      const ruleId = await blockUserIP(ip);
      return res.json({
        status: "success",
        action,
        cloudflare_rule_id: ruleId
      });
    }

    if (action === "revoke_token") {
      const jira = await createJiraRevokeTicket({ user, token });
      return res.json({
        status: "pending_approval",
        action,
        jira_ticket: jira
      });
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

    res.status(400).json({ status: "ignored" });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 8080);
